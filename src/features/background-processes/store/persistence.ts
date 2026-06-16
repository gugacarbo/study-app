import { computeTotalRequestMs } from "@/features/ai/lib/stream-perf-metrics";
import {
	appendLogEntry,
	createEmptyJob,
	ensureAgentRunMessages,
} from "@/features/background-processes/kinds/ingest/job-utils";
import { hydrateIngestStateFromStorage } from "@/features/ingest/store/persistence";
import type { IngestJob } from "@/features/ingest/store/types";
import type {
	BackgroundProcess,
	BackgroundProcessStoreState,
	ConnectionTestBackgroundProcess,
	IngestBackgroundProcess,
	ModelBenchmarkBackgroundProcess,
	PersistedBackgroundProcess,
	PersistedBackgroundProcessState,
	PersistedConnectionTestProcess,
	PersistedIngestProcess,
	PersistedModelBenchmarkProcess,
} from "./types";
import {
	BACKGROUND_PROCESS_STORAGE_KEY,
	ingestJobToProcess,
	ingestProcessId,
	LEGACY_INGEST_STORAGE_KEY,
} from "./types";

const MAX_COMPLETED_INGEST_PROCESSES = 10;
const COMPLETED_INGEST_STATUSES: IngestBackgroundProcess["status"][] = [
	"success",
	"error",
	"canceled",
];

export function trimCompletedIngestProcesses(
	processes: IngestBackgroundProcess[],
): IngestBackgroundProcess[] {
	const completed = processes.filter((process) =>
		COMPLETED_INGEST_STATUSES.includes(process.status),
	);
	const active = processes.filter(
		(process) => !COMPLETED_INGEST_STATUSES.includes(process.status),
	);

	if (completed.length <= MAX_COMPLETED_INGEST_PROCESSES) return processes;

	const kept = completed.slice(
		completed.length - MAX_COMPLETED_INGEST_PROCESSES,
	);
	return [...active, ...kept];
}

function getPersistableProcesses(
	state: BackgroundProcessStoreState,
): PersistedBackgroundProcess[] {
	return state.processes.reduce<PersistedBackgroundProcess[]>(
		(acc, process) => {
			if (process.kind === "ingest") {
				const { buffer: _buffer, ...persisted } = process;
				acc.push(persisted);
				return acc;
			}
			if (
				process.kind === "connection-test" ||
				process.kind === "model-benchmark"
			) {
				acc.push(process);
			}
			return acc;
		},
		[],
	);
}

export function serializeBackgroundProcessStateForStorage(
	state: BackgroundProcessStoreState,
): string {
	const processes = getPersistableProcesses(state);

	return JSON.stringify({
		processes,
		focusedProcessId: state.focusedProcessId,
	} satisfies PersistedBackgroundProcessState);
}

export function clearCompletedIngestProcessesFromState(
	state: BackgroundProcessStoreState,
): BackgroundProcessStoreState {
	const ingestProcesses = state.processes.filter(
		(process): process is IngestBackgroundProcess => process.kind === "ingest",
	);
	const otherProcesses = state.processes.filter(
		(process) => process.kind !== "ingest",
	);
	const keptIngest = ingestProcesses.filter(
		(process) => !COMPLETED_INGEST_STATUSES.includes(process.status),
	);
	const processes = [...otherProcesses, ...keptIngest];
	const focusedProcessId =
		state.focusedProcessId &&
		processes.some((process) => process.id === state.focusedProcessId)
			? state.focusedProcessId
			: null;

	return {
		processes,
		focusedProcessId,
		improveQuestionsBatchByExam: state.improveQuestionsBatchByExam,
		improveQuestionsUiByExam: state.improveQuestionsUiByExam,
		explainQuestionsBatchByExam: state.explainQuestionsBatchByExam,
		explainQuestionsUiByExam: state.explainQuestionsUiByExam,
	};
}

function isPersistedIngestProcess(
	value: unknown,
): value is PersistedIngestProcess {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as PersistedIngestProcess).kind === "ingest"
	);
}

function isPersistedConnectionTestProcess(
	value: unknown,
): value is PersistedConnectionTestProcess {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as PersistedConnectionTestProcess).kind === "connection-test"
	);
}

function isPersistedModelBenchmarkProcess(
	value: unknown,
): value is PersistedModelBenchmarkProcess {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as PersistedModelBenchmarkProcess).kind === "model-benchmark"
	);
}

function createInterruptedIngestProcess(
	process: IngestBackgroundProcess,
): IngestBackgroundProcess {
	const now = Date.now();
	const interruptedJob = appendLogEntry(
		{
			...ingestProcessToHydrationJob(process),
			status: "canceled",
			buffer: [],
			finishedAt: process.finishedAt ?? now,
			stepText: "Interrupted after reload",
			error: "Ingest interrupted after page reload",
		},
		"Ingest interrupted after page reload",
		{
			timestamp: now,
			level: "warning",
		},
	);

	return ingestJobToProcess(interruptedJob);
}

function createInterruptedConnectionTestProcess(
	process: ConnectionTestBackgroundProcess,
): ConnectionTestBackgroundProcess {
	const finishedAt = Date.now();
	const totalRequestMs = computeTotalRequestMs(
		process.startedAt ?? finishedAt,
		finishedAt,
	);

	return {
		...process,
		status: "canceled",
		finishedAt,
		step: "Interrupted after reload",
		error: "Connection test interrupted after page reload",
		streamMetrics: {
			...process.streamMetrics,
			totalRequestMs: totalRequestMs ?? process.streamMetrics.totalRequestMs,
		},
	};
}

function createInterruptedModelBenchmarkProcess(
	process: ModelBenchmarkBackgroundProcess,
): ModelBenchmarkBackgroundProcess {
	const finishedAt = Date.now();
	const totalRequestMs = computeTotalRequestMs(
		process.startedAt ?? finishedAt,
		finishedAt,
	);

	return {
		...process,
		status: "canceled",
		finishedAt,
		step: "Interrupted after reload",
		error: "Model benchmark interrupted after page reload",
		streamMetrics: {
			...process.streamMetrics,
			totalRequestMs: totalRequestMs ?? process.streamMetrics.totalRequestMs,
		},
		benchmarkMetrics: {
			...process.benchmarkMetrics,
			aggregate: {
				...process.benchmarkMetrics.aggregate,
				totalRequestMs:
					totalRequestMs ?? process.benchmarkMetrics.aggregate.totalRequestMs,
			},
		},
	};
}

function ingestProcessToHydrationJob(
	process: IngestBackgroundProcess,
): IngestJob {
	const rawId = process.id.startsWith("ingest:")
		? process.id.slice("ingest:".length)
		: process.id;
	const { kind: _kind, ...rest } = process;
	return { ...rest, id: rawId };
}

function hydratePersistedIngestProcess(
	process: unknown,
): IngestBackgroundProcess | null {
	if (!isPersistedIngestProcess(process)) return null;
	if (typeof process.id !== "string" || typeof process.fileName !== "string") {
		return null;
	}

	const rawId = process.id.startsWith("ingest:")
		? process.id.slice("ingest:".length)
		: process.id;

	const hydratedJob: IngestJob = {
		...createEmptyJob(
			rawId,
			process.fileName,
			[],
			process.enableReview ?? true,
			process.enableExplanations ?? true,
			process.agentConcurrency ?? 10,
		),
		...process,
		id: rawId,
		buffer: [],
		agentRuns: Array.isArray(process.agentRuns)
			? process.agentRuns.map((agentRun) =>
					ensureAgentRunMessages(agentRun as IngestJob["agentRuns"][number]),
				)
			: [],
	};

	const hydratedProcess = ingestJobToProcess(hydratedJob);

	if (
		hydratedProcess.status === "queued" ||
		hydratedProcess.status === "running"
	) {
		return createInterruptedIngestProcess(hydratedProcess);
	}

	return hydratedProcess;
}

function hydratePersistedConnectionTestProcess(
	process: unknown,
): ConnectionTestBackgroundProcess | null {
	if (!isPersistedConnectionTestProcess(process)) return null;
	if (
		typeof process.id !== "string" ||
		typeof process.modelId !== "number" ||
		typeof process.modelDisplayName !== "string"
	) {
		return null;
	}

	const hydratedProcess: ConnectionTestBackgroundProcess = {
		...process,
		providerName:
			typeof process.providerName === "string" ? process.providerName : null,
		prompt: typeof process.prompt === "string" ? process.prompt : "",
		response: typeof process.response === "string" ? process.response : "",
		error: typeof process.error === "string" ? process.error : null,
	};

	if (
		hydratedProcess.status === "queued" ||
		hydratedProcess.status === "running"
	) {
		return createInterruptedConnectionTestProcess(hydratedProcess);
	}

	return hydratedProcess;
}

function hydratePersistedModelBenchmarkProcess(
	process: unknown,
): ModelBenchmarkBackgroundProcess | null {
	if (!isPersistedModelBenchmarkProcess(process)) return null;
	if (
		typeof process.id !== "string" ||
		typeof process.modelId !== "number" ||
		typeof process.modelDisplayName !== "string"
	) {
		return null;
	}

	const hydratedProcess: ModelBenchmarkBackgroundProcess = {
		...process,
		providerName:
			typeof process.providerName === "string" ? process.providerName : null,
		error: typeof process.error === "string" ? process.error : null,
		messages: Array.isArray(process.messages) ? process.messages : [],
		phases: Array.isArray(process.phases) ? process.phases : [],
	};

	if (
		hydratedProcess.status === "queued" ||
		hydratedProcess.status === "running"
	) {
		return createInterruptedModelBenchmarkProcess(hydratedProcess);
	}

	return hydratedProcess;
}

function migrateLegacyIngestState(
	raw: string | null,
): BackgroundProcessStoreState {
	const legacyState = hydrateIngestStateFromStorage(raw);
	const processes = legacyState.jobs.map(ingestJobToProcess);
	const trimmedProcesses = trimCompletedIngestProcesses(processes);
	const focusedProcessId = legacyState.focusedJobId
		? ingestProcessId(legacyState.focusedJobId)
		: null;

	return {
		processes: trimmedProcesses,
		focusedProcessId:
			focusedProcessId &&
			trimmedProcesses.some((process) => process.id === focusedProcessId)
				? focusedProcessId
				: null,
		improveQuestionsBatchByExam: {},
		improveQuestionsUiByExam: {},
		explainQuestionsBatchByExam: {},
		explainQuestionsUiByExam: {},
	};
}

export function hydrateBackgroundProcessStateFromStorage(
	raw: string | null,
): BackgroundProcessStoreState {
	const initialState: BackgroundProcessStoreState = {
		processes: [],
		focusedProcessId: null,
		improveQuestionsBatchByExam: {},
		improveQuestionsUiByExam: {},
		explainQuestionsBatchByExam: {},
		explainQuestionsUiByExam: {},
	};
	if (!raw) return initialState;

	try {
		const parsed = JSON.parse(raw) as Partial<PersistedBackgroundProcessState>;
		const persistedProcesses = Array.isArray(parsed.processes)
			? parsed.processes
					.map((process) => {
						if (isPersistedIngestProcess(process)) {
							return hydratePersistedIngestProcess(process);
						}
						if (isPersistedConnectionTestProcess(process)) {
							return hydratePersistedConnectionTestProcess(process);
						}
						if (isPersistedModelBenchmarkProcess(process)) {
							return hydratePersistedModelBenchmarkProcess(process);
						}
						return null;
					})
					.filter(
						(
							process,
						): process is
							| IngestBackgroundProcess
							| ConnectionTestBackgroundProcess
							| ModelBenchmarkBackgroundProcess => process != null,
					)
			: [];
		const ingestProcesses = persistedProcesses.filter(
			(process): process is IngestBackgroundProcess =>
				process.kind === "ingest",
		);
		const nonIngestProcesses = persistedProcesses.filter(
			(process) => process.kind !== "ingest",
		);
		const trimmedProcesses: BackgroundProcess[] = [
			...trimCompletedIngestProcesses(ingestProcesses),
			...nonIngestProcesses,
		];
		const focusedProcessId =
			typeof parsed.focusedProcessId === "string" &&
			trimmedProcesses.some((process) => process.id === parsed.focusedProcessId)
				? parsed.focusedProcessId
				: null;

		return {
			processes: trimmedProcesses,
			focusedProcessId,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
		explainQuestionsUiByExam: {},
		};
	} catch {
		return initialState;
	}
}

function migrateLegacyStorageIfNeeded(): BackgroundProcessStoreState {
	if (typeof window === "undefined") {
		return {
			processes: [],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
		explainQuestionsUiByExam: {},
		};
	}

	const currentRaw = localStorage.getItem(BACKGROUND_PROCESS_STORAGE_KEY);
	const currentState = hydrateBackgroundProcessStateFromStorage(currentRaw);
	if (currentState.processes.length > 0) {
		return currentState;
	}

	const legacyRaw = localStorage.getItem(LEGACY_INGEST_STORAGE_KEY);
	if (!legacyRaw) {
		return currentState;
	}

	const migrated = migrateLegacyIngestState(legacyRaw);
	try {
		if (migrated.processes.length > 0) {
			localStorage.setItem(
				BACKGROUND_PROCESS_STORAGE_KEY,
				serializeBackgroundProcessStateForStorage(migrated),
			);
		}
		localStorage.removeItem(LEGACY_INGEST_STORAGE_KEY);
	} catch {}

	return migrated;
}

export function loadInitialState(): BackgroundProcessStoreState {
	if (typeof window === "undefined") {
		return {
			processes: [],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
		explainQuestionsUiByExam: {},
		};
	}
	return migrateLegacyStorageIfNeeded();
}

export function persistBackgroundProcessState(
	state: BackgroundProcessStoreState,
): void {
	if (typeof window === "undefined") return;

	try {
		const persistedProcesses = getPersistableProcesses(state);

		if (persistedProcesses.length === 0) {
			localStorage.removeItem(BACKGROUND_PROCESS_STORAGE_KEY);
			return;
		}

		localStorage.setItem(
			BACKGROUND_PROCESS_STORAGE_KEY,
			serializeBackgroundProcessStateForStorage(state),
		);
	} catch {}
}
