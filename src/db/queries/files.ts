import { eq, sql } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import type { FileInfo, FileRecord } from "./types";

export function insertFile(
	this: DBQueries,
	examId: number,
	name: string,
	r2Key: string,
	size: number,
	mimeType?: string,
): Promise<number> {
	return this.db
		.insert(schema.files)
		.values({
			exam_id: examId,
			name,
			r2_key: r2Key,
			mime_type: mimeType || null,
			size,
		})
		.returning({ id: schema.files.id })
		.get()
		.then((result) => result?.id ?? 0);
}

export function getFile(
	this: DBQueries,
	id: number,
): Promise<FileRecord | null> {
	return this.db
		.select()
		.from(schema.files)
		.where(eq(schema.files.id, id))
		.get()
		.then((row) => (row as FileRecord | undefined) ?? null);
}

export function getFilesByExam(
	this: DBQueries,
	examId: number,
): Promise<FileInfo[]> {
	return this.db
		.select({
			id: schema.files.id,
			exam_id: schema.files.exam_id,
			name: schema.files.name,
			r2_key: schema.files.r2_key,
			mime_type: schema.files.mime_type,
			size: schema.files.size,
			created_at: schema.files.created_at,
		})
		.from(schema.files)
		.where(eq(schema.files.exam_id, examId))
		.orderBy(sql`created_at DESC`)
		.all();
}

export function deleteFile(this: DBQueries, id: number): Promise<void> {
	return this.db
		.delete(schema.files)
		.where(eq(schema.files.id, id))
		.run()
		.then(() => undefined);
}
