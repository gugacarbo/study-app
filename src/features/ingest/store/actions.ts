import type { IngestAgentEvent, IngestStageEvent } from "@/lib/sse-stream";
import { ingestStream } from "@/lib/sse-stream";
import { queryClient } from "@/routes/__root";
import { getConfig } from "@/server-functions/config";
import {
	appendChunkToAgentRun,
	appendLogEntry,
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
import { clearCompletedJobsFromState, trimCompletedJobs } from "./persistence";
import { ingestStore } from "./store";
import type { IngestJob } from "./types";

let idCounter = 0;
const abortControllers = new Map<string, AbortController>();

function generateId(): string {
	return `ingest_${Date.now()}_${idCounter++}`;
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function updateJobInState(
	jobId: string,
	updater: (job: IngestJob) => IngestJob,
) {
	ingestStore.setState((state) => ({
		...state,
		jobs: state.jobs.map((job) => (job.id === jobId ? updater(job) : job)),
	}));
}

function getRunningJob(): IngestJob | null {
	const runningJob = ingestStore.state.jobs.find(
		(job) => job.status === "running",
	);
	return runningJob ?? null;
}

async function runJob(jobId: string) {
	const job = ingestStore.state.jobs.find(
		(candidate) => candidate.id === jobId,
	);
	if (job?.status !== "queued") return;

	updateJobInState(jobId, (currentJob) =>
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
		const config = await getConfig();
		updateJobInState(jobId, (currentJob) =>
			appendLogEntry(currentJob, "AI config loaded"),
		);

		const currentJob = ingestStore.state.jobs.find(
			(candidate) => candidate.id === jobId,
		);
		if (currentJob?.status !== "running") return;

		updateJobInState(jobId, (nextJob) =>
			appendLogEntry(
				{
					...nextJob,
					stepText: "Sending file for processing...",
				},
				`File: ${nextJob.fileName}`,
			),
		);

		const controller = new AbortController();
		abortControllers.set(jobId, controller);

		const result = await ingestStream(
			{
				buffer: currentJob.buffer,
				fileName: currentJob.fileName,
				config,
				enableReview: currentJob.enableReview,
				signal: controller.signal,
			},
			{
				onStep: (step) => {
					updateJobInState(jobId, (runningJob) =>
						appendLogEntry({ ...runningJob, stepText: step }, step),
					);
				},
				onChunk: (_text, event) => {
					updateJobInState(jobId, (runningJob) => {
						let nextJob = {
							...runningJob,
							rawStreamText: event?.text
								? runningJob.rawStreamText + event.text
								: runningJob.rawStreamText,
						};
						nextJob = applyChunkEvent(nextJob, event);
						if (event?.agentRunId && event.text) {
							nextJob = appendChunkToAgentRun(
								nextJob,
								event.agentRunId,
								event.text,
							);
						}
						return nextJob;
					});
				},
				onToken: (prompt, completion, total, event) => {
					updateJobInState(jobId, (runningJob) =>
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
					updateJobInState(jobId, (runningJob) =>
						applyWarningEvent(runningJob, message, event),
					);
				},
				onStage: (stage: IngestStageEvent) => {
					updateJobInState(jobId, (runningJob) =>
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
					updateJobInState(jobId, (runningJob) => {
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
					});
				},
			},
		);

		updateJobInState(jobId, (runningJob) =>
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
			updateJobInState(jobId, (runningJob) =>
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
			updateJobInState(jobId, (runningJob) =>
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
		abortControllers.delete(jobId);
		runNextJob();
	}
}

export function runNextJob() {
	const state = ingestStore.state;
	const hasRunning = state.jobs.some((job) => job.status === "running");
	if (hasRunning) return;

	const nextQueuedJob = state.jobs.find((job) => job.status === "queued");
	if (!nextQueuedJob) return;

	void runJob(nextQueuedJob.id);
}

export function enqueueIngest(
	fileName: string,
	buffer: number[],
	enableReview: boolean = true,
) {
	const id = generateId();
	const job = createEmptyJob(id, fileName, buffer, enableReview);

	ingestStore.setState((state) => {
		const updatedJobs = trimCompletedJobs([...state.jobs, job]);
		return { ...state, jobs: updatedJobs };
	});
	runNextJob();
}

export function cancelJob(jobId: string) {
	const job = ingestStore.state.jobs.find(
		(candidate) => candidate.id === jobId,
	);
	if (!job) return;

	if (job.status === "queued") {
		updateJobInState(jobId, (queuedJob) =>
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

	if (job.status === "running") {
		const controller = abortControllers.get(jobId);
		if (controller) {
			controller.abort();
		}
	}
}

export function removeJob(jobId: string) {
	ingestStore.setState((state) => ({
		...state,
		jobs: state.jobs.filter((job) => job.id !== jobId),
		focusedJobId: state.focusedJobId === jobId ? null : state.focusedJobId,
	}));
}

export function clearSavedIngestJobs() {
	ingestStore.setState((state) => clearCompletedJobsFromState(state));
}

export function focusJob(jobId: string) {
	ingestStore.setState((state) => ({ ...state, focusedJobId: jobId }));
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
	const runningJob = getRunningJob();
	if (runningJob) {
		e.preventDefault();
	}
}

export { handleBeforeUnload };

if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", handleBeforeUnload);
}
