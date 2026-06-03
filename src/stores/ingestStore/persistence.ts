import { appendLogEntry, createEmptyJob } from "./job-utils";
import type {
	IngestJob,
	IngestStoreState,
	PersistedIngestJob,
	PersistedIngestStoreState,
} from "./types";

const MAX_COMPLETED_JOBS = 10;
const COMPLETED_JOB_STATUSES: IngestJob["status"][] = [
	"success",
	"error",
	"canceled",
];

export function trimCompletedJobs(jobs: IngestJob[]): IngestJob[] {
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

export function serializeIngestStateForStorage(
	state: IngestStoreState,
): string {
	return JSON.stringify({
		jobs: state.jobs.map(({ buffer: _buffer, ...job }) => job),
		focusedJobId: state.focusedJobId,
	} satisfies PersistedIngestStoreState);
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

export function hydrateIngestStateFromStorage(
	raw: string | null,
): IngestStoreState {
	const initialState: IngestStoreState = { jobs: [], focusedJobId: null };
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

export function loadInitialState(): IngestStoreState {
	if (typeof window === "undefined") return { jobs: [], focusedJobId: null };
	return hydrateIngestStateFromStorage(localStorage.getItem("ingest-jobs"));
}

export function persistIngestState(state: IngestStoreState) {
	if (typeof window === "undefined") return;

	try {
		if (state.jobs.length === 0) {
			localStorage.removeItem("ingest-jobs");
			return;
		}

		localStorage.setItem("ingest-jobs", serializeIngestStateForStorage(state));
	} catch {}
}
