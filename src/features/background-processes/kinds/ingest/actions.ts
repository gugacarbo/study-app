import { flushSync } from "react-dom";
import type { IngestAgentEvent, IngestStageEvent } from "@/lib/sse-stream";
import { ingestStream } from "@/lib/sse-stream";
import { queryClient } from "@/routes/__root";
import type { IngestJob } from "@/features/ingest/store/types";
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
import {
	appendChunkToAgentRun,
	appendLogEntry,
	appendReasoningToAgentRun,
	appendToolCallToAgentRun,
	appendToolResultToAgentRun,
	applyChunkEvent,
	applyTokenEvent,
	applyWarningEvent,
	createEmptyJob,
	syncJobTokenTotals,
	updateFlowStages,
	upsertAgentRun,
} from "./job-utils";

function resolveProcessId(jobId: string): string {
	return ingestProcessId(jobId);
}

function generateId(): string {
	return ingestProcessId(crypto.randomUUID());
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
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

async function runJob(processId: string): Promise<void> {
	const process = getIngestProcess(processId);
	if (process?.status !== "queued") return;

	updateIngestProcess(processId, (currentJob) =>
		appendLogEntry(
			{
				...currentJob,
				status: "running",
				startedAt: Date.now(),
				stepText: "Loading AI configuration...",
			},
			"Starting ingest job",
		),
	);

	try {
		const currentProcess = getIngestProcess(processId);
		if (currentProcess?.status !== "running") return;

		const currentJob = ingestProcessToJob(currentProcess);

		updateIngestProcess(processId, (nextJob) =>
			appendLogEntry(
				{
					...nextJob,
					stepText: "Sending file for processing...",
				},
				`File: ${nextJob.fileName}`,
			),
		);

		const controller = new AbortController();
		registerAbort(processId, controller);

		const result = await ingestStream(
			{
				buffer: currentJob.buffer,
				fileName: currentJob.fileName,
				enableReview: currentJob.enableReview,
				enableExplanations: currentJob.enableExplanations,
				agentConcurrency: currentJob.agentConcurrency,
				signal: controller.signal,
			},
			{
				onStep: (step) => {
					updateIngestProcess(processId, (runningJob) =>
						appendLogEntry({ ...runningJob, stepText: step }, step),
					);
				},
				onChunk: (_text, event) => {
					updateIngestProcess(processId, (runningJob) => {
						let nextJob = {
							...runningJob,
							rawStreamText: event?.text
								? runningJob.rawStreamText + event.text
								: runningJob.rawStreamText,
						};
						nextJob = applyChunkEvent(nextJob, event);
						if (event?.agentRunId && event.text) {
							nextJob =
								event.kind === "reasoning"
									? appendReasoningToAgentRun(
											nextJob,
											event.agentRunId,
											event.text,
										)
									: appendChunkToAgentRun(
											nextJob,
											event.agentRunId,
											event.text,
										);
						}
						return nextJob;
					});
				},
				onToken: (prompt, completion, total, event) => {
					updateIngestProcess(processId, (runningJob) =>
						appendLogEntry(
							applyTokenEvent(
								runningJob,
								event ?? { prompt, completion, total },
							),
							`Token usage updated (${total.toLocaleString()})`,
							{
								agentRunId: event?.agentRunId ?? ("__meta__" as string),
							},
						),
					);
				},
				onWarning: (message, event) => {
					updateIngestProcess(processId, (runningJob) =>
						applyWarningEvent(runningJob, message, event),
					);
				},
				onStage: (stage: IngestStageEvent) => {
					updateIngestProcess(processId, (runningJob) =>
						appendLogEntry(
							updateFlowStages(runningJob, stage),
							`${stage.label}: ${stage.status}`,
							{
								stageId: stage.stageId,
								timestamp: stage.timestamp,
								level: stage.status === "error" ? "error" : "info",
							},
						),
					);
				},
				onAgent: (event: IngestAgentEvent) => {
					const applyAgentEvent = (runningJob: IngestJob) => {
						let nextJob = syncJobTokenTotals(upsertAgentRun(runningJob, event));
						if (event.eventType === "tool-call") {
							nextJob = appendToolCallToAgentRun(nextJob, event);
						}
						if (event.eventType === "tool-result") {
							nextJob = appendToolResultToAgentRun(nextJob, event);
						}
						if (event.warning) {
							nextJob = applyWarningEvent(nextJob, event.warning, {
								message: event.warning,
								stageId: event.stageId,
								agentRunId: event.agentRunId,
								timestamp: event.timestamp,
							});
						}
						return nextJob;
					};

					if (event.eventType === "tool-result") {
						flushSync(() => {
							updateIngestProcess(processId, applyAgentEvent);
						});
						return;
					}

					updateIngestProcess(processId, applyAgentEvent);
				},
			},
		);

		updateIngestProcess(processId, (runningJob) =>
			appendLogEntry(
				{
					...runningJob,
					status: "success",
					finishedAt: Date.now(),
					result,
					stepText: "Completed",
					flowStages: runningJob.flowStages.map((stage) =>
						stage.status === "running"
							? { ...stage, status: "done" as const, timestamp: Date.now() }
							: stage,
					),
				},
				`Ingest complete: ${result.questions} questions, topics: ${result.topics.join(", ")}`,
			),
		);

		queryClient.invalidateQueries({ queryKey: ["exams"] });
		queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
		queryClient.invalidateQueries({ queryKey: ["stats"] });
	} catch (err) {
		if (isAbortError(err)) {
			updateIngestProcess(processId, (runningJob) =>
				appendLogEntry(
					{
						...runningJob,
						status: "canceled",
						finishedAt: Date.now(),
						stepText: "Canceled",
						error: "Upload canceled by user",
						flowStages: runningJob.flowStages.map((stage) =>
							stage.status === "running"
								? { ...stage, status: "error" as const, timestamp: Date.now() }
								: stage,
						),
					},
					"Job canceled by user",
					{ level: "warning" },
				),
			);
		} else {
			const message =
				err instanceof Error ? err.message : "Unknown ingest error";
			updateIngestProcess(processId, (runningJob) =>
				appendLogEntry(
					{
						...runningJob,
						status: "error",
						finishedAt: Date.now(),
						stepText: `Error: ${message}`,
						error: message,
						flowStages: runningJob.flowStages.map((stage) =>
							stage.status === "running"
								? { ...stage, status: "error" as const, timestamp: Date.now() }
								: stage,
						),
					},
					`Error: ${message}`,
					{ level: "error" },
				),
			);
		}
	} finally {
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
		updateIngestProcess(processId, (queuedJob) =>
			appendLogEntry(
				{
					...queuedJob,
					status: "canceled",
					finishedAt: Date.now(),
					stepText: "Canceled",
					error: "Canceled before starting",
				},
				"Job canceled from queue",
				{ level: "warning" },
			),
		);
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
