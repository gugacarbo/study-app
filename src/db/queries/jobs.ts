import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
	ACTIVE_INGEST_STATUSES,
	canManuallyCancelJobStatus,
	type IngestJobMetadata,
	type ImproveQuestionsJobMetadata,
	JOB_KIND,
	JOB_STATUS,
	type JobStatus,
	parseIngestJobMetadata,
} from "@/lib/job-kinds";
import {
	deriveJobProcessing as deriveProcessingState,
	JOB_LEASE_TTL_MS,
	JOB_PROCESSING_STATE,
} from "@/lib/job-processing";
import { type JsonObject, parseJsonObject } from "@/lib/json-value";
import type { AppDatabase } from "../client";
import * as schema from "../schema";
import { appendJobEvent } from "./job-events";

export type JobRow = typeof schema.backgroundJobs.$inferSelect;
export type BackgroundJobRow = JobRow;
export type BackgroundJob = JobRow;
export type { BackgroundJobEventRow, JobEventRow } from "./job-events";
export { appendJobEvent, listJobEvents } from "./job-events";

type JobUpdateValues = {
	status?: JobStatus;
	phase?: string | null;
	error?: string | null;
	metadata?: string | null;
	workerId?: string | null | ReturnType<typeof sql>;
	processingStartedAt?: string | null | ReturnType<typeof sql>;
	heartbeatAt?: string | null | ReturnType<typeof sql>;
	leaseExpiresAt?: string | null | ReturnType<typeof sql>;
	lastRecoveredAt?: string | null | ReturnType<typeof sql>;
	cancelledAt?: string | null | ReturnType<typeof sql>;
	updatedAt: ReturnType<typeof sql>;
};

function jobLeaseExpiresSql() {
	return sql`datetime(CURRENT_TIMESTAMP, '+' || ${Math.ceil(JOB_LEASE_TTL_MS / 1000)} || ' seconds')`;
}

function withLeaseCleared(values: JobUpdateValues): JobUpdateValues {
	return {
		...values,
		workerId: null,
		processingStartedAt: null,
		heartbeatAt: null,
		leaseExpiresAt: null,
	};
}

function serializeMetadata(
	metadata:
		| IngestJobMetadata
		| ImproveQuestionsJobMetadata
		| string
		| null
		| undefined,
): string | null {
	if (metadata == null) return null;
	if (typeof metadata === "string") return metadata;
	return JSON.stringify(metadata);
}

export async function createJob(
	db: AppDatabase,
	input: {
		id: string;
		userId: string;
		kind: string;
		status: JobStatus;
		metadata?: IngestJobMetadata | ImproveQuestionsJobMetadata | string | null;
		phase?: string | null;
	},
) {
	await db.insert(schema.backgroundJobs).values({
		id: input.id,
		userId: input.userId,
		kind: input.kind,
		status: input.status,
		phase: input.phase ?? null,
		metadata: serializeMetadata(input.metadata),
	});
}

export async function getJobById(
	db: AppDatabase,
	jobId: string,
	userId: string,
): Promise<JobRow | null> {
	const rows = await db
		.select()
		.from(schema.backgroundJobs)
		.where(
			and(
				eq(schema.backgroundJobs.id, jobId),
				eq(schema.backgroundJobs.userId, userId),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

export async function getJobByIdInternal(
	db: AppDatabase,
	jobId: string,
): Promise<JobRow | null> {
	const rows = await db
		.select()
		.from(schema.backgroundJobs)
		.where(eq(schema.backgroundJobs.id, jobId))
		.limit(1);
	return rows[0] ?? null;
}

export async function updateJobStatus(
	db: AppDatabase,
	jobId: string,
	patch: {
		status?: JobStatus;
		phase?: string | null;
		error?: string | null;
		metadata?: IngestJobMetadata | ImproveQuestionsJobMetadata | string | null;
	},
) {
	let values: JobUpdateValues = {
		updatedAt: sql`CURRENT_TIMESTAMP`,
	};
	if (patch.status !== undefined) values.status = patch.status;
	if (patch.phase !== undefined) values.phase = patch.phase;
	if (patch.error !== undefined) values.error = patch.error;
	if (patch.metadata !== undefined) {
		values.metadata = serializeMetadata(patch.metadata);
	}
	if (patch.status === JOB_STATUS.CANCELLED) {
		values.cancelledAt = sql`CURRENT_TIMESTAMP`;
		values = withLeaseCleared(values);
	} else if (
		patch.status === JOB_STATUS.AWAITING_UPLOAD ||
		patch.status === JOB_STATUS.QUEUED ||
		patch.status === JOB_STATUS.COMPLETED ||
		patch.status === JOB_STATUS.FAILED
	) {
		values = withLeaseCleared(values);
	}
	await db
		.update(schema.backgroundJobs)
		.set(values)
		.where(eq(schema.backgroundJobs.id, jobId));
}

export type AdminJobListItem = {
	id: string;
	userId: string;
	userEmail: string | null;
	kind: string;
	status: string;
	phase: string | null;
	error: string | null;
	metadata: JsonObject | null;
	cancelRequestedAt: string | null;
	cancelledAt: string | null;
	workerId: string | null;
	processingStartedAt: string | null;
	heartbeatAt: string | null;
	leaseExpiresAt: string | null;
	runAttempts: number;
	recoveryAttempts: number;
	lastRecoveredAt: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

function parseJobMetadata(raw: string | null): JsonObject | null {
	return parseJsonObject(raw);
}

export async function listJobsForAdmin(
	db: AppDatabase,
	options?: { limit?: number },
): Promise<AdminJobListItem[]> {
	const limit = options?.limit ?? 100;
	const rows = await db
		.select({
			id: schema.backgroundJobs.id,
			userId: schema.backgroundJobs.userId,
			userEmail: schema.user.email,
			kind: schema.backgroundJobs.kind,
			status: schema.backgroundJobs.status,
			phase: schema.backgroundJobs.phase,
			error: schema.backgroundJobs.error,
			metadata: schema.backgroundJobs.metadata,
			cancelRequestedAt: schema.backgroundJobs.cancelRequestedAt,
			cancelledAt: schema.backgroundJobs.cancelledAt,
			workerId: schema.backgroundJobs.workerId,
			processingStartedAt: schema.backgroundJobs.processingStartedAt,
			heartbeatAt: schema.backgroundJobs.heartbeatAt,
			leaseExpiresAt: schema.backgroundJobs.leaseExpiresAt,
			runAttempts: schema.backgroundJobs.runAttempts,
			recoveryAttempts: schema.backgroundJobs.recoveryAttempts,
			lastRecoveredAt: schema.backgroundJobs.lastRecoveredAt,
			createdAt: schema.backgroundJobs.createdAt,
			updatedAt: schema.backgroundJobs.updatedAt,
		})
		.from(schema.backgroundJobs)
		.leftJoin(schema.user, eq(schema.backgroundJobs.userId, schema.user.id))
		.orderBy(desc(schema.backgroundJobs.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		...row,
		metadata: parseJobMetadata(row.metadata),
	}));
}

export function deriveJobProcessing(job: JobRow, now = new Date()) {
	return deriveProcessingState(job, now);
}

export async function claimQueuedJobForProcessing(
	db: AppDatabase,
	jobId: string,
	workerId: string,
): Promise<JobRow | null> {
	await db
		.update(schema.backgroundJobs)
		.set({
			status: JOB_STATUS.RUNNING,
			workerId,
			processingStartedAt: sql`CURRENT_TIMESTAMP`,
			heartbeatAt: sql`CURRENT_TIMESTAMP`,
			leaseExpiresAt: jobLeaseExpiresSql(),
			runAttempts: sql`${schema.backgroundJobs.runAttempts} + 1`,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(
			and(
				eq(schema.backgroundJobs.id, jobId),
				eq(schema.backgroundJobs.status, JOB_STATUS.QUEUED),
			),
		);

	const claimed = await getJobByIdInternal(db, jobId);
	return claimed?.status === JOB_STATUS.RUNNING && claimed.workerId === workerId
		? claimed
		: null;
}

export async function renewJobLease(
	db: AppDatabase,
	jobId: string,
	workerId: string,
): Promise<boolean> {
	await db
		.update(schema.backgroundJobs)
		.set({
			heartbeatAt: sql`CURRENT_TIMESTAMP`,
			leaseExpiresAt: jobLeaseExpiresSql(),
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(
			and(
				eq(schema.backgroundJobs.id, jobId),
				eq(schema.backgroundJobs.status, JOB_STATUS.RUNNING),
				eq(schema.backgroundJobs.workerId, workerId),
			),
		);

	const job = await getJobByIdInternal(db, jobId);
	return job?.status === JOB_STATUS.RUNNING && job.workerId === workerId;
}

export async function markJobRecoveredAsQueued(
	db: AppDatabase,
	jobId: string,
	patch: {
		phase?: string | null;
		metadata?: IngestJobMetadata | ImproveQuestionsJobMetadata | string | null;
		error?: string | null;
	},
) {
	await db
		.update(schema.backgroundJobs)
		.set({
			status: JOB_STATUS.QUEUED,
			phase: patch.phase ?? null,
			metadata:
				patch.metadata === undefined
					? undefined
					: serializeMetadata(patch.metadata),
			error: patch.error ?? null,
			workerId: null,
			processingStartedAt: null,
			heartbeatAt: null,
			leaseExpiresAt: null,
			recoveryAttempts: sql`${schema.backgroundJobs.recoveryAttempts} + 1`,
			lastRecoveredAt: sql`CURRENT_TIMESTAMP`,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.backgroundJobs.id, jobId));
}

export async function requestJobCancelIfActive(
	db: AppDatabase,
	job: JobRow,
): Promise<{ cancelled: boolean; alreadyTerminal: boolean }> {
	if (!canManuallyCancelJobStatus(job.status)) {
		return { cancelled: false, alreadyTerminal: true };
	}
	await setCancelRequested(db, job.id);

	if (job.status !== JOB_STATUS.RUNNING) {
		await updateJobStatus(db, job.id, {
			status: JOB_STATUS.CANCELLED,
			...(job.status === JOB_STATUS.FAILED ? {} : { error: null }),
		});
		return { cancelled: true, alreadyTerminal: false };
	}

	const processing = deriveJobProcessing(job);
	if (processing.state === JOB_PROCESSING_STATE.STALE_RUNNING) {
		await updateJobStatus(db, job.id, {
			status: JOB_STATUS.CANCELLED,
			error: null,
		});
		await appendJobEvent(db, job.id, {
			type: "system",
			text: "Cancelamento concluído — worker inativo detectado no momento da solicitação.",
		});
	}

	return { cancelled: true, alreadyTerminal: false };
}

export async function setCancelRequested(db: AppDatabase, jobId: string) {
	await db
		.update(schema.backgroundJobs)
		.set({
			cancelRequestedAt: sql`CURRENT_TIMESTAMP`,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.backgroundJobs.id, jobId));
}

export async function listActiveJobsForUser(
	db: AppDatabase,
	userId: string,
): Promise<JobRow[]> {
	return db
		.select()
		.from(schema.backgroundJobs)
		.where(
			and(
				eq(schema.backgroundJobs.userId, userId),
				inArray(schema.backgroundJobs.status, [...ACTIVE_INGEST_STATUSES]),
			),
		)
		.orderBy(desc(schema.backgroundJobs.updatedAt))
		.limit(5);
}

export async function listJobsForUser(
	db: AppDatabase,
	userId: string,
): Promise<JobRow[]> {
	return db
		.select()
		.from(schema.backgroundJobs)
		.where(eq(schema.backgroundJobs.userId, userId))
		.orderBy(desc(schema.backgroundJobs.createdAt));
}

export type UserJobsPage = {
	rows: JobRow[];
	total: number;
	page: number;
	pageSize: number;
};

export async function listJobsPageForUser(
	db: AppDatabase,
	userId: string,
	page: number,
	pageSize: number,
): Promise<UserJobsPage> {
	const offset = (page - 1) * pageSize;
	const [countResult] = await db
		.select({ total: count() })
		.from(schema.backgroundJobs)
		.where(eq(schema.backgroundJobs.userId, userId));

	const rows = await db
		.select()
		.from(schema.backgroundJobs)
		.where(eq(schema.backgroundJobs.userId, userId))
		.orderBy(
			desc(schema.backgroundJobs.createdAt),
			desc(schema.backgroundJobs.id),
		)
		.limit(pageSize)
		.offset(offset);

	return {
		rows,
		total: Number(countResult.total),
		page,
		pageSize,
	};
}

export async function getIngestJobIdByExamId(
	db: AppDatabase,
	userId: string,
	examId: string,
): Promise<string | null> {
	const rows = await db
		.select({
			id: schema.backgroundJobs.id,
			metadata: schema.backgroundJobs.metadata,
		})
		.from(schema.backgroundJobs)
		.where(
			and(
				eq(schema.backgroundJobs.userId, userId),
				eq(schema.backgroundJobs.kind, JOB_KIND.INGEST),
			),
		)
		.orderBy(desc(schema.backgroundJobs.createdAt))
		.limit(50);
	for (const row of rows) {
		const metadata = parseIngestJobMetadata(row.metadata);
		if (metadata?.examId === examId) {
			return row.id;
		}
	}
	return null;
}

export async function hasActiveIngestJob(
	db: AppDatabase,
	userId: string,
	examId: string,
): Promise<boolean> {
	const rows = await db
		.select()
		.from(schema.backgroundJobs)
		.where(
			and(
				eq(schema.backgroundJobs.userId, userId),
				eq(schema.backgroundJobs.kind, JOB_KIND.INGEST),
				inArray(schema.backgroundJobs.status, [...ACTIVE_INGEST_STATUSES]),
			),
		);
	return rows.some((job) => {
		const metadata = parseIngestJobMetadata(job.metadata);
		return metadata?.examId === examId;
	});
}
