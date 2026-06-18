import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";
import { createId } from "./helpers";

export type JobEventRow = typeof schema.backgroundJobEvents.$inferSelect;
export type BackgroundJobEventRow = JobEventRow;

export async function appendJobEvent(
	db: AppDatabase,
	jobId: string,
	payload: unknown,
): Promise<JobEventRow> {
	const rows = await db
		.select({
			maxSeq: sql<number>`coalesce(max(${schema.backgroundJobEvents.seq}), 0)`,
		})
		.from(schema.backgroundJobEvents)
		.where(eq(schema.backgroundJobEvents.jobId, jobId));

	const nextSeq = (rows[0]?.maxSeq ?? 0) + 1;
	const eventId = createId();
	const payloadJson =
		typeof payload === "string" ? payload : JSON.stringify(payload);

	await db.insert(schema.backgroundJobEvents).values({
		id: eventId,
		jobId,
		seq: nextSeq,
		payload: payloadJson,
	});

	return {
		id: eventId,
		jobId,
		seq: nextSeq,
		payload: payloadJson,
		createdAt: null,
	};
}

export async function listJobEvents(
	db: AppDatabase,
	jobId: string,
	afterSeq = 0,
): Promise<JobEventRow[]> {
	return db
		.select()
		.from(schema.backgroundJobEvents)
		.where(
			and(
				eq(schema.backgroundJobEvents.jobId, jobId),
				gt(schema.backgroundJobEvents.seq, afterSeq),
			),
		)
		.orderBy(asc(schema.backgroundJobEvents.seq));
}
