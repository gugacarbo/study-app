import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type FileRow = typeof schema.files.$inferSelect;

export async function insertFile(
	db: AppDatabase,
	input: {
		id: string;
		examId: string;
		name: string;
		r2Key: string;
		mimeType?: string | null;
		size?: number | null;
		ttlSeconds?: number;
	},
) {
	await db.insert(schema.files).values({
		id: input.id,
		examId: input.examId,
		name: input.name,
		r2Key: input.r2Key,
		mimeType: input.mimeType ?? null,
		size: input.size ?? null,
		ttlSeconds: input.ttlSeconds ?? 0,
	});
}

export async function deleteFile(db: AppDatabase, fileId: string) {
	await db.delete(schema.files).where(eq(schema.files.id, fileId));
}

export async function getFileByIdWithOwnership(
	db: AppDatabase,
	fileId: string,
	userId: string,
) {
	const rows = await db
		.select({
			file: schema.files,
			examUserId: schema.exams.userId,
		})
		.from(schema.files)
		.innerJoin(schema.exams, eq(schema.files.examId, schema.exams.id))
		.where(eq(schema.files.id, fileId))
		.limit(1);
	const row = rows[0];
	if (!row || row.examUserId !== userId) return null;
	return row.file;
}

export async function listExpiredFiles(db: AppDatabase, limit: number) {
	return db
		.select()
		.from(schema.files)
		.where(
			and(
				sql`${schema.files.ttlSeconds} > 0`,
				sql`datetime(${schema.files.createdAt}, '+' || ${schema.files.ttlSeconds} || ' seconds') < datetime('now')`,
			),
		)
		.limit(limit);
}
