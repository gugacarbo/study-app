import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";
import {
	ACTIVE_INGEST_STATUSES,
	JOB_KIND,
	type IngestJobMetadata,
	parseIngestJobMetadata,
	type JobStatus,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";

export type JobRow = typeof schema.backgroundJobs.$inferSelect;
export type BackgroundJobRow = JobRow;
export type BackgroundJob = JobRow;
export type { JobEventRow, BackgroundJobEventRow } from "./job-events";
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

export async function setCancelRequested(db: AppDatabase, jobId: string) {
	await db
		.update(schema.backgroundJobs)
		.set({
			cancelRequestedAt: sql`CURRENT_TIMESTAMP`,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.backgroundJobs.id, jobId));
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
