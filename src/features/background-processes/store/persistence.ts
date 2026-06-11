import {
	appendLogEntry,
	createEmptyJob,
	ensureAgentRunMessages,
} from "@/features/ingest/store/job-utils";
import type { IngestJob } from "@/features/ingest/store/types";
import { hydrateIngestStateFromStorage } from "@/features/ingest/store/persistence";
import type {
	BackgroundProcessStoreState,
	IngestBackgroundProcess,
	PersistedBackgroundProcessState,
	PersistedIngestProcess,
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

export function serializeBackgroundProcessStateForStorage(
	state: BackgroundProcessStoreState,
): string {
	const ingestProcesses = state.processes.filter(
		(process): process is IngestBackgroundProcess => process.kind === "ingest",
	);

	return JSON.stringify({
		processes: ingestProcesses.map(({ buffer: _buffer, ...process }) => process),
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
	};
}

export function hydrateBackgroundProcessStateFromStorage(
	raw: string | null,
): BackgroundProcessStoreState {
	const initialState: BackgroundProcessStoreState = {
		processes: [],
		focusedProcessId: null,
		improveQuestionsBatchByExam: {},
	};
	if (!raw) return initialState;

	try {
		const parsed = JSON.parse(raw) as Partial<PersistedBackgroundProcessState>;
		const ingestProcesses = Array.isArray(parsed.processes)
			? parsed.processes
					.map((process) => hydratePersistedIngestProcess(process))
					.filter((process): process is IngestBackgroundProcess => process != null)
			: [];
		const trimmedProcesses = trimCompletedIngestProcesses(ingestProcesses);
		const focusedProcessId =
			typeof parsed.focusedProcessId === "string" &&
			trimmedProcesses.some(
				(process) => process.id === parsed.focusedProcessId,
			)
				? parsed.focusedProcessId
				: null;

		return {
			processes: trimmedProcesses,
			focusedProcessId,
			improveQuestionsBatchByExam: {},
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
		};
	}
	return migrateLegacyStorageIfNeeded();
}

export function persistBackgroundProcessState(
	state: BackgroundProcessStoreState,
): void {
	if (typeof window === "undefined") return;

	try {
		const ingestProcesses = state.processes.filter(
			(process): process is IngestBackgroundProcess => process.kind === "ingest",
		);

		if (ingestProcesses.length === 0) {
			localStorage.removeItem(BACKGROUND_PROCESS_STORAGE_KEY);
			return;
		}

		localStorage.setItem(
			BACKGROUND_PROCESS_STORAGE_KEY,
			serializeBackgroundProcessStateForStorage(state),
		);
	} catch {}
}
