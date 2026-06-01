import { Store } from "@tanstack/store";
import type { IngestResultEvent } from "@/lib/sse-stream";
import { ingestStream } from "@/lib/sse-stream";
import { queryClient } from "@/routes/__root";
import { getConfig } from "@/server-functions/config";

export interface TokenTotals {
	prompt: number;
	completion: number;
	total: number;
}

export interface FlowStage {
	stageId: string;
	label: string;
	status: "pending" | "running" | "done" | "warning" | "error";
	timestamp: number;
	meta?: Record<string, unknown>;
}

export interface IngestJob {
	id: string;
	fileName: string;
	status: "queued" | "running" | "success" | "error" | "canceled";
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	stepText: string;
	logs: string[];
	streamText: string;
	tokenTotals: TokenTotals;
	warnings: string[];
	result: IngestResultEvent | null;
	error: string | null;
	flowStages: FlowStage[];
	buffer: number[];
}

export interface IngestStoreState {
	jobs: IngestJob[];
	focusedJobId: string | null;
}

function createEmptyJob(
	id: string,
	fileName: string,
	buffer: number[],
): IngestJob {
	return {
		id,
		fileName,
		status: "queued",
		createdAt: Date.now(),
		startedAt: null,
		finishedAt: null,
		stepText: "",
		logs: [],
		streamText: "",
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		warnings: [],
		result: null,
		error: null,
		flowStages: [],
		buffer,
	};
}

const MAX_COMPLETED_JOBS = 10;

function trimCompletedJobs(jobs: IngestJob[]): IngestJob[] {
	const completed = jobs.filter((j) =>
		["success", "error", "canceled"].includes(j.status),
	);
	const active = jobs.filter(
		(j) => !["success", "error", "canceled"].includes(j.status),
	);

	if (completed.length <= MAX_COMPLETED_JOBS) return jobs;

	const kept = completed.slice(completed.length - MAX_COMPLETED_JOBS);
	return [...active, ...kept];
}

let idCounter = 0;
function generateId(): string {
	return `ingest_${Date.now()}_${idCounter++}`;
}

const initialState: IngestStoreState = {
	jobs: [],
	focusedJobId: null,
};

export const ingestStore = new Store<IngestStoreState>(initialState);

const abortControllers = new Map<string, AbortController>();

function appendLog(logs: string[], line: string): string[] {
	const timestamp = new Date().toLocaleTimeString();
	return [...logs, `[${timestamp}] ${line}`];
}

export function getState(): IngestStoreState {
	return ingestStore.state;
}

export function subscribe(
	callback: (state: IngestStoreState) => void,
): () => void {
	const subscription = ingestStore.subscribe(() => callback(ingestStore.state));
	return () => subscription.unsubscribe();
}

export function focusJob(jobId: string) {
	ingestStore.setState((s) => ({ ...s, focusedJobId: jobId }));
}

export function getRunningJob(): IngestJob | null {
	const running = ingestStore.state.jobs.find((j) => j.status === "running");
	return running ?? null;
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function updateJobInState(
	jobId: string,
	updater: (job: IngestJob) => IngestJob,
) {
	ingestStore.setState((s) => ({
		...s,
		jobs: s.jobs.map((j) => (j.id === jobId ? updater(j) : j)),
	}));
}

async function runJob(jobId: string) {
	const job = ingestStore.state.jobs.find((j) => j.id === jobId);
	if (job?.status !== "queued") return;

	updateJobInState(jobId, (j) => ({
		...j,
		status: "running",
		startedAt: Date.now(),
		stepText: "Loading AI configuration...",
		logs: appendLog(j.logs, "Starting ingest job"),
	}));

	try {
		const config = await getConfig();
		updateJobInState(jobId, (j) => ({
			...j,
			logs: appendLog(j.logs, "AI config loaded"),
		}));

		const currentJob = ingestStore.state.jobs.find((j) => j.id === jobId);
		if (currentJob?.status !== "running") return;

		updateJobInState(jobId, (j) => ({
			...j,
			stepText: "Sending file for processing...",
			logs: appendLog(j.logs, `File: ${j.fileName}`),
		}));

		const controller = new AbortController();
		abortControllers.set(jobId, controller);

		const result = await ingestStream(
			{
				buffer: currentJob.buffer,
				fileName: currentJob.fileName,
				config,
				signal: controller.signal,
			},
			{
				onStep: (step) => {
					updateJobInState(jobId, (j) => ({
						...j,
						stepText: step,
						logs: appendLog(j.logs, step),
					}));
				},
				onChunk: (text) => {
					updateJobInState(jobId, (j) => ({
						...j,
						streamText: `${j.streamText}${text}`,
						logs: appendLog(j.logs, `Chunk received (${text.length} chars)`),
					}));
				},
				onToken: (prompt, completion, total) => {
					updateJobInState(jobId, (j) => ({
						...j,
						tokenTotals: { prompt, completion, total },
						logs: appendLog(
							j.logs,
							`Token usage updated (${total.toLocaleString()})`,
						),
					}));
				},
				onWarning: (message) => {
					updateJobInState(jobId, (j) => ({
						...j,
						warnings: [...j.warnings, message],
						streamText: `${j.streamText}\n⚠ ${message}\n`,
						logs: appendLog(j.logs, `Warning: ${message}`),
					}));
				},
				onStage: (stage) => {
					updateJobInState(jobId, (j) => {
						const existingIndex = j.flowStages.findIndex(
							(fs) => fs.stageId === stage.stageId,
						);
						if (existingIndex >= 0) {
							const updated = [...j.flowStages];
							updated[existingIndex] = {
								stageId: stage.stageId,
								label: stage.label,
								status:
									stage.status === "pending" ||
									stage.status === "running" ||
									stage.status === "done" ||
									stage.status === "warning" ||
									stage.status === "error"
										? stage.status
										: "running",
								timestamp: stage.timestamp,
								meta: stage.meta,
							};
							return { ...j, flowStages: updated };
						}
						return {
							...j,
							flowStages: [
								...j.flowStages,
								{
									stageId: stage.stageId,
									label: stage.label,
									status:
										stage.status === "pending" ||
										stage.status === "running" ||
										stage.status === "done" ||
										stage.status === "warning" ||
										stage.status === "error"
											? stage.status
											: "running",
									timestamp: stage.timestamp,
									meta: stage.meta,
								},
							],
						};
					});
				},
			},
		);

		updateJobInState(jobId, (j) => ({
			...j,
			status: "success",
			finishedAt: Date.now(),
			result,
			stepText: "Completed",
			flowStages: j.flowStages.map((fs) =>
				fs.status === "running"
					? { ...fs, status: "done" as const, timestamp: Date.now() }
					: fs,
			),
			logs: appendLog(
				j.logs,
				`Ingest complete: ${result.questions} questions, topics: ${result.topics.join(", ")}`,
			),
		}));

		queryClient.invalidateQueries({ queryKey: ["exams"] });
		queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
		queryClient.invalidateQueries({ queryKey: ["stats"] });
	} catch (err) {
		if (isAbortError(err)) {
			updateJobInState(jobId, (j) => ({
				...j,
				status: "canceled",
				finishedAt: Date.now(),
				stepText: "Canceled",
				error: "Upload canceled by user",
				flowStages: j.flowStages.map((fs) =>
					fs.status === "running"
						? { ...fs, status: "error" as const, timestamp: Date.now() }
						: fs,
				),
				logs: appendLog(j.logs, "Job canceled by user"),
			}));
		} else {
			const message =
				err instanceof Error ? err.message : "Unknown ingest error";
			updateJobInState(jobId, (j) => ({
				...j,
				status: "error",
				finishedAt: Date.now(),
				stepText: `Error: ${message}`,
				error: message,
				flowStages: j.flowStages.map((fs) =>
					fs.status === "running"
						? { ...fs, status: "error" as const, timestamp: Date.now() }
						: fs,
				),
				logs: appendLog(j.logs, `Error: ${message}`),
			}));
		}
	} finally {
		abortControllers.delete(jobId);
		runNextJob();
	}
}

function runNextJob() {
	const state = ingestStore.state;
	const hasRunning = state.jobs.some((j) => j.status === "running");
	if (hasRunning) return;

	const nextQueued = state.jobs.find((j) => j.status === "queued");
	if (!nextQueued) return;

	runJob(nextQueued.id);
}

export function enqueueIngest(fileName: string, buffer: number[]) {
	const id = generateId();
	const job = createEmptyJob(id, fileName, buffer);

	ingestStore.setState((s) => {
		const updated = trimCompletedJobs([...s.jobs, job]);
		return { ...s, jobs: updated };
	});

	runNextJob();
}

export function cancelJob(jobId: string) {
	const job = ingestStore.state.jobs.find((j) => j.id === jobId);
	if (!job) return;

	if (job.status === "queued") {
		updateJobInState(jobId, (j) => ({
			...j,
			status: "canceled",
			finishedAt: Date.now(),
			stepText: "Canceled",
			error: "Canceled before starting",
			logs: appendLog(j.logs, "Job canceled from queue"),
		}));
		return;
	}

	if (job.status === "running") {
		const controller = abortControllers.get(jobId);
		if (controller) {
			controller.abort();
		}
	}
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
	const running = getRunningJob();
	if (running) {
		e.preventDefault();
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", handleBeforeUnload);
}
