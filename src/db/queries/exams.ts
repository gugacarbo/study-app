import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export async function getExamById(
	db: AppDatabase,
	examId: string,
	userId: string,
) {
	const rows = await db
		.select()
		.from(schema.exams)
		.where(and(eq(schema.exams.id, examId), eq(schema.exams.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createExam(
	db: AppDatabase,
	input: { id: string; userId: string; name: string; source?: string },
) {
	await db.insert(schema.exams).values({
		id: input.id,
		userId: input.userId,
		name: input.name,
		source: input.source ?? null,
	});
}
