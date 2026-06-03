import { Store } from "@tanstack/store";
import type {
	IngestAgentEvent,
	IngestChunkEvent,
	IngestResultEvent,
	IngestStageEvent,
	IngestTokenEvent,
	IngestWarningEvent,
} from "@/lib/sse-stream";
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
	status: "pending" | "running" | "done" | "warning" | "error" | "skipped";
	timestamp: number;
	meta?: Record<string, unknown>;
}

type IngestLogLevel = "info" | "warning" | "error";

interface IngestLogEntry {
	id: string;
	timestamp: number;
	stageId: string | null;
	agentRunId: string | null;
	level: IngestLogLevel;
	message: string;
}

interface IngestOutputEntry {
	id: string;
	timestamp: number;
	stageId: string | null;
	agentRunId: string | null;
	kind: "chunk" | "warning";
	text: string;
}

type IngestAgentStatus =
	| "pending"
	| "running"
	| "done"
	| "warning"
	| "error"
	| "skipped";

export interface IngestAgentRun {
	id: string;
	stageId: string;
	label: string;
	status: IngestAgentStatus;
	timestamp: number;
	systemPrompt: string;
	userPrompt: string;
	outputText: string;
	rawOutput: unknown;
	error: string | null;
	warnings: string[];
	tokenTotals: TokenTotals;
	meta?: Record<string, unknown>;
}

/**
 * `tokenTotals` is the accumulated display total for the entire ingest job —
 * it is NOT the last event received. It represents:
 *
 *    sum of all agent-run tokenTotals + nonAgentTokenTotals
 *
 * - Token events WITHOUT `agentRunId` add to both `tokenTotals` and `nonAgentTokenTotals`.
 * - Token events WITH `agentRunId` update the matching agent run, then
 *   recompute `tokenTotals` from all agent runs plus the non-agent pool —
 *   avoiding double counting.
 * - `nonAgentTokenTotals` tracks tokens reported outside any specific
 *   agent run (e.g., global pipeline tokens), ensuring they survive
 *   agent-based recomputation of the job total.
 */
export interface IngestJob {
	id: string;
	fileName: string;
	status: "queued" | "running" | "success" | "error" | "canceled";
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	stepText: string;
	logs: IngestLogEntry[];
	outputEntries: IngestOutputEntry[];
	agentRuns: IngestAgentRun[];
	tokenTotals: TokenTotals;
	nonAgentTokenTotals: TokenTotals;
	warnings: string[];
	result: IngestResultEvent | null;
	error: string | null;
	flowStages: FlowStage[];
	buffer: number[];
	enableReview: boolean;
	rawStreamText: string;
}

export interface IngestStoreState {
	jobs: IngestJob[];
	focusedJobId: string | null;
}

interface PersistedIngestJob extends Omit<IngestJob, "buffer"> {
	buffer?: number[];
}

interface PersistedIngestStoreState {
	jobs: PersistedIngestJob[];
	focusedJobId: string | null;
}

function createEmptyTotals(): TokenTotals {
	return { prompt: 0, completion: 0, total: 0 };
}

function createEmptyJob(
	id: string,
	fileName: string,
	buffer: number[],
	enableReview: boolean,
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
		outputEntries: [],
		agentRuns: [],
		tokenTotals: createEmptyTotals(),
		nonAgentTokenTotals: createEmptyTotals(),
		warnings: [],
		result: null,
		error: null,
		flowStages: [],
		buffer,
		enableReview,
		rawStreamText: "",
	};
}

const MAX_COMPLETED_JOBS = 10;
const COMPLETED_JOB_STATUSES: IngestJob["status"][] = [
	"success",
	"error",
	"canceled",
];
export const INGEST_STORAGE_KEY = "ingest-jobs";

function trimCompletedJobs(jobs: IngestJob[]): IngestJob[] {
	const completed = jobs.filter((job) =>
		COMPLETED_JOB_STATUSES.includes(job.status),
	);
	const active = jobs.filter(
		(job) => !COMPLETED_JOB_STATUSES.includes(job.status),
	);

	if (completed.length <= MAX_COMPLETED_JOBS) return jobs;

	const kept = completed.slice(completed.length - MAX_COMPLETED_JOBS);
	return [...active, ...kept];
}

let idCounter = 0;
let entryCounter = 0;

function generateId(): string {
	return `ingest_${Date.now()}_${idCounter++}`;
}

function generateEntryId(prefix: string): string {
	return `${prefix}_${Date.now()}_${entryCounter++}`;
}

function isPersistedIngestJob(value: unknown): value is PersistedIngestJob {
	return typeof value === "object" && value !== null;
}

function createInterruptedJob(job: IngestJob): IngestJob {
	const now = Date.now();
	const interruptedJob: IngestJob = {
		...job,
		status: "canceled",
		buffer: [],
		finishedAt: job.finishedAt ?? now,
		stepText: "Interrupted after reload",
		error: "Ingest interrupted after page reload",
	};

	return appendLogEntry(
		interruptedJob,
		"Ingest interrupted after page reload",
		{
			timestamp: now,
			level: "warning",
		},
	);
}

function hydratePersistedJob(job: unknown): IngestJob | null {
	if (!isPersistedIngestJob(job)) return null;
	if (typeof job.id !== "string" || typeof job.fileName !== "string") {
		return null;
	}

	const hydratedJob: IngestJob = {
		...createEmptyJob(job.id, job.fileName, [], job.enableReview ?? true),
		...job,
		buffer: [],
	};

	if (hydratedJob.status === "queued" || hydratedJob.status === "running") {
		return createInterruptedJob(hydratedJob);
	}

	return hydratedJob;
}

export function serializeIngestStateForStorage(
	state: IngestStoreState,
): string {
	return JSON.stringify({
		jobs: state.jobs.map(({ buffer: _buffer, ...job }) => job),
		focusedJobId: state.focusedJobId,
	} satisfies PersistedIngestStoreState);
}

export function hydrateIngestStateFromStorage(
	raw: string | null,
): IngestStoreState {
	if (!raw) return initialState;

	try {
		const parsed = JSON.parse(raw) as Partial<PersistedIngestStoreState>;
		const jobs = Array.isArray(parsed.jobs)
			? parsed.jobs
					.map((job) => hydratePersistedJob(job))
					.filter((job): job is IngestJob => job != null)
			: [];
		const focusedJobId =
			typeof parsed.focusedJobId === "string" &&
			jobs.some((job) => job.id === parsed.focusedJobId)
				? parsed.focusedJobId
				: null;

		return {
			jobs: trimCompletedJobs(jobs),
			focusedJobId,
		};
	} catch {
		return initialState;
	}
}

function loadInitialState(): IngestStoreState {
	if (typeof window === "undefined") return initialState;
	return hydrateIngestStateFromStorage(
		localStorage.getItem(INGEST_STORAGE_KEY),
	);
}

function persistIngestState(state: IngestStoreState) {
	if (typeof window === "undefined") return;

	try {
		if (state.jobs.length === 0) {
			localStorage.removeItem(INGEST_STORAGE_KEY);
			return;
		}

		localStorage.setItem(
			INGEST_STORAGE_KEY,
			serializeIngestStateForStorage(state),
		);
	} catch {}
}

export function clearCompletedJobsFromState(
	state: IngestStoreState,
): IngestStoreState {
	const jobs = state.jobs.filter(
		(job) => !COMPLETED_JOB_STATUSES.includes(job.status),
	);
	const focusedJobId =
		state.focusedJobId && jobs.some((job) => job.id === state.focusedJobId)
			? state.focusedJobId
			: null;

	return { jobs, focusedJobId };
}

const initialState: IngestStoreState = {
	jobs: [],
	focusedJobId: null,
};

export const ingestStore = new Store<IngestStoreState>(loadInitialState());

let persistTimer: ReturnType<typeof setTimeout> | null = null;
ingestStore.subscribe(() => {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistIngestState(ingestStore.state);
	}, 0);
});

const abortControllers = new Map<string, AbortController>();

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function normalizeStageStatus(status: string): FlowStage["status"] {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "warning" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}

function normalizeAgentStatus(status?: string): IngestAgentStatus {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "warning" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}

function extractTokenTotals(value: unknown): TokenTotals | null {
	if (typeof value !== "object" || value === null) return null;
	const tokenValue = value as Record<string, unknown>;
	const prompt =
		typeof tokenValue.prompt === "number"
			? tokenValue.prompt
			: typeof tokenValue.promptTokens === "number"
				? tokenValue.promptTokens
				: typeof tokenValue.inputTokens === "number"
					? tokenValue.inputTokens
					: undefined;
	const completion =
		typeof tokenValue.completion === "number"
			? tokenValue.completion
			: typeof tokenValue.completionTokens === "number"
				? tokenValue.completionTokens
				: typeof tokenValue.outputTokens === "number"
					? tokenValue.outputTokens
					: undefined;
	const total =
		typeof tokenValue.total === "number"
			? tokenValue.total
			: typeof tokenValue.totalTokens === "number"
				? tokenValue.totalTokens
				: prompt != null && completion != null
					? prompt + completion
					: undefined;

	if (prompt == null && completion == null && total == null) {
		return null;
	}

	return {
		prompt: prompt ?? 0,
		completion: completion ?? 0,
		total: total ?? (prompt ?? 0) + (completion ?? 0),
	};
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

function appendLogEntry(
	job: IngestJob,
	message: string,
	options?: {
		timestamp?: number;
		stageId?: string | null;
		agentRunId?: string | null;
		level?: IngestLogLevel;
	},
): IngestJob {
	return {
		...job,
		logs: [
			...job.logs,
			{
				id: generateEntryId("log"),
				timestamp: options?.timestamp ?? Date.now(),
				stageId: options?.stageId ?? null,
				agentRunId: options?.agentRunId ?? null,
				level: options?.level ?? "info",
				message,
			},
		],
	};
}

function sumAgentTokenTotals(agentRuns: IngestAgentRun[]): TokenTotals {
	return agentRuns.reduce(
		(totals, agentRun) => ({
			prompt: totals.prompt + agentRun.tokenTotals.prompt,
			completion: totals.completion + agentRun.tokenTotals.completion,
			total: totals.total + agentRun.tokenTotals.total,
		}),
		createEmptyTotals(),
	);
}

/**
 * Recompute `tokenTotals` from the agent-run sums plus the non-agent pool.
 * Avoids double counting by never adding agent-bound token events directly
 * to the job total — only through this recomputation.
 */
export function syncJobTokenTotals(job: IngestJob): IngestJob {
	const agentTotals = sumAgentTokenTotals(job.agentRuns);

	return {
		...job,
		tokenTotals: {
			prompt: agentTotals.prompt + job.nonAgentTokenTotals.prompt,
			completion: agentTotals.completion + job.nonAgentTokenTotals.completion,
			total: agentTotals.total + job.nonAgentTokenTotals.total,
		},
	};
}

function appendOutputEntry(
	job: IngestJob,
	entry: {
		stageId?: string | null;
		agentRunId?: string | null;
		text: string;
		timestamp?: number;
		kind?: IngestOutputEntry["kind"];
	},
): IngestJob {
	return {
		...job,
		outputEntries: [
			...job.outputEntries,
			{
				id: generateEntryId("output"),
				stageId: entry.stageId ?? null,
				agentRunId: entry.agentRunId ?? null,
				text: entry.text,
				timestamp: entry.timestamp ?? Date.now(),
				kind: entry.kind ?? "chunk",
			},
		],
	};
}

function getFallbackStageId(
	job: IngestJob,
	preferred?: string | null,
): string | null {
	if (preferred) return preferred;

	const runningStage = [...job.flowStages]
		.reverse()
		.find((stage) => stage.status === "running");
	if (runningStage) return runningStage.stageId;

	return job.flowStages[job.flowStages.length - 1]?.stageId ?? null;
}

function updateFlowStages(job: IngestJob, stage: IngestStageEvent): IngestJob {
	const normalizedStatus = normalizeStageStatus(stage.status);
	const existingIndex = job.flowStages.findIndex(
		(flowStage) => flowStage.stageId === stage.stageId,
	);

	if (existingIndex === -1) {
		return {
			...job,
			flowStages: [
				...job.flowStages,
				{
					stageId: stage.stageId,
					label: stage.label,
					status: normalizedStatus,
					timestamp: stage.timestamp,
					meta: stage.meta,
				},
			],
		};
	}

	const nextStages = [...job.flowStages];
	nextStages[existingIndex] = {
		stageId: stage.stageId,
		label: stage.label,
		status: normalizedStatus,
		timestamp: stage.timestamp,
		meta: stage.meta,
	};

	return {
		...job,
		flowStages: nextStages,
	};
}

export function upsertAgentRun(
	job: IngestJob,
	event: IngestAgentEvent,
): IngestJob {
	const timestamp = event.timestamp ?? Date.now();
	const status = normalizeAgentStatus(event.status);
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === event.agentRunId,
	);

	if (existingIndex === -1) {
		const tokenTotals = extractTokenTotals(event.tokens) ?? createEmptyTotals();
		return {
			...job,
			agentRuns: [
				...job.agentRuns,
				{
					id: event.agentRunId,
					stageId: event.stageId,
					label: event.label,
					status,
					timestamp,
					systemPrompt: event.systemPrompt ?? "",
					userPrompt: event.userPrompt ?? "",
					outputText: event.rawText ?? "",
					rawOutput: event.finalObject ?? event.rawText ?? null,
					error: event.error ?? null,
					warnings: event.warning ? [event.warning] : [],
					tokenTotals,
					meta: event.meta,
				},
			],
		};
	}

	const nextAgentRuns = [...job.agentRuns];
	const existing = nextAgentRuns[existingIndex];
	const tokenTotals = extractTokenTotals(event.tokens);
	nextAgentRuns[existingIndex] = {
		...existing,
		stageId: event.stageId,
		label: event.label,
		status,
		timestamp,
		systemPrompt: event.systemPrompt ?? existing.systemPrompt,
		userPrompt: event.userPrompt ?? existing.userPrompt,
		outputText:
			existing.outputText.length > 0
				? existing.outputText
				: (event.rawText ?? existing.outputText),
		rawOutput: event.finalObject ?? event.rawText ?? existing.rawOutput,
		error: event.error ?? existing.error,
		warnings: event.warning
			? [...existing.warnings, event.warning]
			: existing.warnings,
		tokenTotals: tokenTotals ?? existing.tokenTotals,
		meta: event.meta ?? existing.meta,
	};

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
}

function appendChunkToAgentRun(
	job: IngestJob,
	agentRunId: string,
	chunk: string,
): IngestJob {
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === agentRunId,
	);
	if (existingIndex === -1) return job;

	const nextAgentRuns = [...job.agentRuns];
	nextAgentRuns[existingIndex] = {
		...nextAgentRuns[existingIndex],
		outputText: `${nextAgentRuns[existingIndex].outputText}${chunk}`,
	};

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
}

function applyChunkEvent(job: IngestJob, event?: IngestChunkEvent): IngestJob {
	if (!event?.text) return job;

	return appendOutputEntry(job, {
		stageId: getFallbackStageId(job, event.stageId ?? null),
		agentRunId: event.agentRunId ?? null,
		text: event.text,
		timestamp: event.timestamp,
	});
}

export function applyWarningEvent(
	job: IngestJob,
	message: string,
	event?: IngestWarningEvent,
): IngestJob {
	const stageId = getFallbackStageId(job, event?.stageId ?? null);
	let nextJob = {
		...job,
		warnings: [...job.warnings, message],
	};

	nextJob = appendOutputEntry(nextJob, {
		stageId,
		agentRunId: event?.agentRunId ?? null,
		text: message,
		timestamp: event?.timestamp,
		kind: "warning",
	});
	nextJob = appendLogEntry(nextJob, message, {
		timestamp: event?.timestamp,
		stageId,
		agentRunId: event?.agentRunId ?? null,
		level: "warning",
	});

	if (!event?.agentRunId) {
		return nextJob;
	}
	const existingRun = nextJob.agentRuns.find(
		(agentRun) => agentRun.id === event.agentRunId,
	);

	const agentEvent: IngestAgentEvent = {
		agentRunId: event.agentRunId,
		stageId: stageId ?? "review",
		label: existingRun?.label ?? event.agentRunId,
		status: existingRun?.status === "error" ? "error" : "warning",
		timestamp: event.timestamp,
		warning: message,
	};

	return upsertAgentRun(nextJob, agentEvent);
}

/**
 * Apply a token usage event to the job.
 *
 * - Without `agentRunId`: adds directly to `job.tokenTotals` AND
 *   `job.nonAgentTokenTotals` (so non-agent tokens survive later
 *   agent-based recomputation).
 * - With `agentRunId`: updates the matching agent run's token totals,
 *   then recomputes the job total from all agents + non-agent pool
 *   via `syncJobTokenTotals`, avoiding double counting.
 */
export function applyTokenEvent(
	job: IngestJob,
	event: IngestTokenEvent,
): IngestJob {
	if (!event.agentRunId) {
		return {
			...job,
			tokenTotals: {
				prompt: job.tokenTotals.prompt + event.prompt,
				completion: job.tokenTotals.completion + event.completion,
				total: job.tokenTotals.total + event.total,
			},
			nonAgentTokenTotals: {
				prompt: job.nonAgentTokenTotals.prompt + event.prompt,
				completion: job.nonAgentTokenTotals.completion + event.completion,
				total: job.nonAgentTokenTotals.total + event.total,
			},
		};
	}

	return syncJobTokenTotals(
		upsertAgentRun(job, {
			agentRunId: event.agentRunId,
			stageId: getFallbackStageId(job, event.stageId ?? null) ?? "review",
			label: event.agentRunId,
			timestamp: event.timestamp,
			tokens: {
				prompt: event.prompt,
				completion: event.completion,
				total: event.total,
			},
		}),
	);
}

export function focusJob(jobId: string) {
	ingestStore.setState((state) => ({ ...state, focusedJobId: jobId }));
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
						appendLogEntry(
							{
								...runningJob,
								stepText: step,
							},
							step,
						),
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
								agentRunId:
									event?.agentRunId ?? ("__meta__" as string),
							},
						),
					);
				},
				onWarning: (message, event) => {
					updateJobInState(jobId, (runningJob) =>
						applyWarningEvent(runningJob, message, event),
					);
				},
				onStage: (stage) => {
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
				onAgent: (event) => {
					updateJobInState(jobId, (runningJob) => {
						let nextJob = syncJobTokenTotals(upsertAgentRun(runningJob, event));
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

function runNextJob() {
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

export function clearSavedIngestJobs() {
	ingestStore.setState((state) => clearCompletedJobsFromState(state));
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
	const runningJob = getRunningJob();
	if (runningJob) {
		e.preventDefault();
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", handleBeforeUnload);
}
