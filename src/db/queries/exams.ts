import { and, count, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type ExamListItem = {
	id: string;
	name: string;
	source: string | null;
	createdAt: string | null;
	questionCount: number;
};

export async function listExamsByUserId(
	db: AppDatabase,
	userId: string,
): Promise<ExamListItem[]> {
	const rows = await db
		.select({
			id: schema.exams.id,
			name: schema.exams.name,
			source: schema.exams.source,
			createdAt: schema.exams.createdAt,
			questionCount: count(schema.questions.id),
		})
		.from(schema.exams)
		.leftJoin(
			schema.questions,
			eq(schema.questions.examId, schema.exams.id),
		)
		.where(eq(schema.exams.userId, userId))
		.groupBy(schema.exams.id)
		.orderBy(desc(schema.exams.createdAt));

	return rows.map((row) => ({
		...row,
		questionCount: Number(row.questionCount),
	}));
}

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

export async function updateExamSource(
	db: AppDatabase,
	examId: string,
	userId: string,
	source: string,
) {
	const exam = await getExamById(db, examId, userId);
	if (!exam) return false;
	await db
		.update(schema.exams)
		.set({ source })
		.where(and(eq(schema.exams.id, examId), eq(schema.exams.userId, userId)));
	return true;
}

export async function updateExamAfterIngestUpload(
	db: AppDatabase,
	examId: string,
	userId: string,
	input: { source: string; name?: string },
) {
	const exam = await getExamById(db, examId, userId);
	if (!exam) return false;
	await db
		.update(schema.exams)
		.set({
			source: input.source,
			...(input.name != null ? { name: input.name } : {}),
		})
		.where(and(eq(schema.exams.id, examId), eq(schema.exams.userId, userId)));
	return true;
}
