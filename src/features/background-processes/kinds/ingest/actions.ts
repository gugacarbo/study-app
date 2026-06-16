import { flushSync } from "react-dom";
import {
	createIngestPipelineReducer,
	createIngestPipelineState,
	createRafProcessBatcher,
	ingestPipelineReducerHandlers,
	isAbortError,
	runJobPipeline,
	type IngestPipelineState,
} from "@/features/ai/pipeline/client";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import type { IngestJob } from "@/features/ingest/store/types";
import { queryClient } from "@/routes/__root";
import {
	clearCompletedIngestProcessesFromState,
	trimCompletedIngestProcesses,
} from "../../store/persistence";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import {
	backgroundProcessStore,
	focusProcess as focusProcessInStore,
	removeProcess,
	updateProcess,
} from "../../store/store";
import type { IngestBackgroundProcess } from "../../store/types";
import {
	ingestJobToProcess,
	ingestProcessId,
	ingestProcessToJob,
	isIngestProcess,
} from "../../store/types";
import { createEmptyJob } from "./job-utils";

type IngestStorePatch = Partial<
	Pick<
		IngestJob,
		| "status"
		| "startedAt"
		| "finishedAt"
		| "stepText"
		| "logs"
		| "agentRuns"
		| "tokenTotals"
		| "nonAgentTokenTotals"
		| "warnings"
		| "result"
		| "error"
		| "stages"
	>
>;

function resolveProcessId(jobId: string): string {
	return ingestProcessId(jobId);
}

function generateId(): string {
	return ingestProcessId(crypto.randomUUID());
}

function updateIngestProcess(
	processId: string,
	updater: (job: IngestJob) => IngestJob,
): void {
	updateProcess(processId, (process) => {
		if (!isIngestProcess(process)) return process;
		return ingestJobToProcess(updater(ingestProcessToJob(process)));
	});
}

function getIngestProcess(processId: string): IngestBackgroundProcess | null {
	const process = backgroundProcessStore.state.processes.find(
		(candidate) => candidate.id === resolveProcessId(processId),
	);
	return process && isIngestProcess(process) ? process : null;
}

function pipelineStateToPatch(
	state: IngestPipelineState,
): Omit<IngestStorePatch, "logs"> {
	return {
		stages: state.stages,
		agentRuns: state.agentRuns,
		stepText: state.stepText,
		tokenTotals: state.tokenTotals,
		nonAgentTokenTotals: state.nonAgentTokenTotals,
		warnings: state.warnings,
		result: state.result,
	};
}

function applyProcessLog(
	job: IngestJob,
	entry: PipelineLogEntry,
): Pick<IngestJob, "logs" | "stepText"> {
	return {
		logs: [...job.logs, entry],
		stepText: entry.agentRunId ? job.stepText : entry.message,
	};
}

function finalizeRunningStages(stages: IngestJob["stages"]) {
	return stages.map((stage) =>
		stage.status === "running"
			? { ...stage, status: "done" as const, timestamp: Date.now() }
			: stage,
	);
}

function markRunningStagesError(stages: IngestJob["stages"]) {
	return stages.map((stage) =>
		stage.status === "running"
			? { ...stage, status: "error" as const, timestamp: Date.now() }
			: stage,
	);
}

function createIngestBatcher(processId: string) {
	return createRafProcessBatcher<IngestBackgroundProcess, IngestStorePatch>(
		processId,
		{
			isProcess: (process): process is IngestBackgroundProcess =>
				isIngestProcess(process as IngestBackgroundProcess),
			patchProcess: (process, patch) =>
				({ ...process, ...patch }) as IngestBackgroundProcess,
		},
	);
}

async function runJob(processId: string): Promise<void> {
	const process = getIngestProcess(processId);
	if (process?.status !== "queued") return;

	updateIngestProcess(processId, (job) => ({
		...job,
		status: "running",
		startedAt: Date.now(),
		stepText: "Loading AI configuration...",
	}));

	let batcher: ReturnType<typeof createIngestBatcher> | null = null;

	try {
		const currentProcess = getIngestProcess(processId);
		if (currentProcess?.status !== "running") return;

		const currentJob = ingestProcessToJob(currentProcess);
		const controller = new AbortController();
		registerAbort(processId, controller);

		const reducer = createIngestPipelineReducer(createIngestPipelineState());
		batcher = createIngestBatcher(processId);
		const streamHandlers = ingestPipelineReducerHandlers(reducer);

		const syncReducer = () => {
			batcher?.queue(pipelineStateToPatch(reducer.getState()));
		};

		await runJobPipeline({
			request: {
				url: "/api/ingest",
				init: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						buffer: currentJob.buffer,
						fileName: currentJob.fileName,
						enableReview: currentJob.enableReview,
						enableExplanations: currentJob.enableExplanations,
						agentConcurrency: currentJob.agentConcurrency,
					}),
				},
				signal: controller.signal,
			},
			handlers: {
				onStage(ctx, data) {
					streamHandlers.onStage?.(ctx, data);
					syncReducer();
				},
				onProgress(ctx, data) {
					streamHandlers.onProgress?.(ctx, data);
					syncReducer();
				},
				onAgentRun(ctx, data) {
					streamHandlers.onAgentRun?.(ctx, data);
					if (data.eventType === "tool-result") {
						flushSync(() => {
							batcher?.flush(pipelineStateToPatch(reducer.getState()));
						});
					} else {
						syncReducer();
					}
				},
				onResult(ctx, data) {
					streamHandlers.onResult?.(ctx, data);
					syncReducer();
				},
				onLog: (entry) => {
					const active = getIngestProcess(processId);
					if (!active) return;
					batcher?.queue(
						applyProcessLog(ingestProcessToJob(active), entry),
					);
				},
			},
			expectResult: true,
		});

		batcher.flush();
		const finalState = reducer.getState();
		const result = finalState.result;
		if (!result) {
			throw new Error("Ingest stream finished without a result");
		}

		updateIngestProcess(processId, (job) => ({
			...job,
			...pipelineStateToPatch(finalState),
			status: "success",
			finishedAt: Date.now(),
			stepText: "Completed",
			result,
			stages: finalizeRunningStages(finalState.stages),
		}));

		queryClient.invalidateQueries({ queryKey: ["exams"] });
		queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
		queryClient.invalidateQueries({ queryKey: ["stats"] });
	} catch (err) {
		if (isAbortError(err)) {
			updateIngestProcess(processId, (runningJob) => ({
				...runningJob,
				status: "canceled",
				finishedAt: Date.now(),
				stepText: "Canceled",
				error: "Upload canceled by user",
				stages: markRunningStagesError(runningJob.stages),
			}));
		} else {
			const message =
				err instanceof Error ? err.message : "Unknown ingest error";
			updateIngestProcess(processId, (runningJob) => ({
				...runningJob,
				status: "error",
				finishedAt: Date.now(),
				stepText: `Error: ${message}`,
				error: message,
				stages: markRunningStagesError(runningJob.stages),
			}));
		}
	} finally {
		batcher?.dispose();
		unregisterAbort(processId);
		runNextQueued();
	}
}

export function startQueuedIngest(processId: string): void {
	void runJob(processId);
}

export function enqueueIngest(
	fileName: string,
	buffer: number[],
	enableReview: boolean = true,
	enableExplanations: boolean = true,
	agentConcurrency: number = 10,
): string {
	const processId = generateId();
	const rawId = processId.slice("ingest:".length);
	const job = createEmptyJob(
		rawId,
		fileName,
		buffer,
		enableReview,
		enableExplanations,
		agentConcurrency,
	);
	const process = ingestJobToProcess(job);

	backgroundProcessStore.setState((state) => {
		const ingestProcesses = state.processes.filter(isIngestProcess);
		const otherProcesses = state.processes.filter(
			(candidate) => !isIngestProcess(candidate),
		);
		const trimmed = trimCompletedIngestProcesses([
			...ingestProcesses,
			process,
		]);
		return {
			...state,
			processes: [...otherProcesses, ...trimmed],
			focusedProcessId: processId,
		};
	});
	runNextQueued();
	return processId;
}

export function cancelJob(jobId: string): void {
	const processId = resolveProcessId(jobId);
	const process = getIngestProcess(processId);
	if (!process) return;

	if (process.status === "queued") {
		updateIngestProcess(processId, (queuedJob) => ({
			...queuedJob,
			status: "canceled",
			finishedAt: Date.now(),
			stepText: "Canceled",
			error: "Canceled before starting",
		}));
		return;
	}

	if (process.status === "running") {
		const abortController = getAbortController(processId);
		if (abortController) {
			abortController.abort();
		}
	}
}

export function removeJob(jobId: string): void {
	removeProcess(resolveProcessId(jobId));
}

export function clearSavedIngestJobs(): void {
	backgroundProcessStore.setState(clearCompletedIngestProcessesFromState);
}

export function focusJob(jobId: string): void {
	focusProcessInStore(resolveProcessId(jobId));
}
