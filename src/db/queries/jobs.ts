import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
	ACTIVE_INGEST_STATUSES,
	type IngestJobMetadata,
	isCancellableJobStatus,
	JOB_KIND,
	JOB_STATUS,
	type JobStatus,
	parseIngestJobMetadata,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import { type JsonObject, parseJsonObject } from "@/lib/json-value";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

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
	updatedAt: ReturnType<typeof sql>;
};

function serializeMetadata(
	metadata: IngestJobMetadata | string | null | undefined,
): string | null {
	if (metadata == null) return null;
	if (typeof metadata === "string") return metadata;
	return serializeIngestJobMetadata(metadata);
}

export async function createJob(
	db: AppDatabase,
	input: {
		id: string;
		userId: string;
		kind: string;
		status: JobStatus;
		metadata?: IngestJobMetadata | string | null;
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
		metadata?: IngestJobMetadata | string | null;
	},
) {
	const values: JobUpdateValues = {
		updatedAt: sql`CURRENT_TIMESTAMP`,
	};
	if (patch.status !== undefined) values.status = patch.status;
	if (patch.phase !== undefined) values.phase = patch.phase;
	if (patch.error !== undefined) values.error = patch.error;
	if (patch.metadata !== undefined) {
		values.metadata = serializeMetadata(patch.metadata);
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

export async function requestJobCancelIfActive(
	db: AppDatabase,
	job: JobRow,
): Promise<{ cancelled: boolean; alreadyTerminal: boolean }> {
	if (!isCancellableJobStatus(job.status)) {
		return { cancelled: false, alreadyTerminal: true };
	}
	await setCancelRequested(db, job.id);

	// No consumer work yet — finalize immediately instead of waiting for dequeue.
	if (
		job.status === JOB_STATUS.QUEUED ||
		job.status === JOB_STATUS.AWAITING_UPLOAD
	) {
		await updateJobStatus(db, job.id, {
			status: JOB_STATUS.CANCELLED,
			error: null,
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

export async function getIngestJobIdByExamId(
	db: AppDatabase,
	userId: string,
	examId: string,
): Promise<string | null> {
	const rows = await db
		.select({ id: schema.backgroundJobs.id, metadata: schema.backgroundJobs.metadata })
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
