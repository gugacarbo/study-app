import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type QuestionRow = typeof schema.questions.$inferSelect;

export type QuestionInsertInput = {
	id: string;
	examId: string;
	question: string;
	options: string;
	answers: string;
	scoringMode: "exact" | "partial";
	topic?: string | null;
	explanation?: string | null;
	deepExplanation?: string | null;
};

export type BatchInsertQuestionsResult = {
	insertedCount: number;
	skippedDuplicateCount: number;
};

/** Matches SPEC-0004 normalizeQuestionText — shared with ingest persist layer. */
export function normalizeQuestionText(text: string): string {
	return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function insertQuestion(
	db: AppDatabase,
	input: QuestionInsertInput,
) {
	await db.insert(schema.questions).values({
		id: input.id,
		examId: input.examId,
		question: input.question,
		options: input.options,
		answers: input.answers,
		scoringMode: input.scoringMode,
		topic: input.topic ?? null,
		explanation: input.explanation ?? null,
		deepExplanation: input.deepExplanation ?? null,
	});
}

export async function listQuestionsByExam(
	db: AppDatabase,
	examId: string,
): Promise<QuestionRow[]> {
	return db
		.select()
		.from(schema.questions)
		.where(eq(schema.questions.examId, examId))
		.orderBy(schema.questions.createdAt);
}

export async function getQuestionById(
	db: AppDatabase,
	questionId: string,
): Promise<QuestionRow | null> {
	const rows = await db
		.select()
		.from(schema.questions)
		.where(eq(schema.questions.id, questionId))
		.limit(1);
	return rows[0] ?? null;
}

export async function existsNormalizedQuestion(
	db: AppDatabase,
	examId: string,
	normalizedText: string,
): Promise<boolean> {
	const rows = await db
		.select({ question: schema.questions.question })
		.from(schema.questions)
		.where(eq(schema.questions.examId, examId));

	return rows.some(
		(row) => normalizeQuestionText(row.question) === normalizedText,
	);
}

export async function updateQuestionById(
	db: AppDatabase,
	input: {
		questionId: string;
		userId: string;
		question: string;
		options: string;
		answers: string;
		scoringMode: "exact" | "partial";
		topic?: string | null;
		explanation?: string | null;
		deepExplanation?: string | null;
	},
): Promise<boolean> {
	const rows = await db
		.select({ examId: schema.questions.examId })
		.from(schema.questions)
		.innerJoin(schema.exams, eq(schema.exams.id, schema.questions.examId))
		.where(
			and(
				eq(schema.questions.id, input.questionId),
				eq(schema.exams.userId, input.userId),
			),
		)
		.limit(1);

	if (rows.length === 0) {
		return false;
	}

	await db
		.update(schema.questions)
		.set({
			question: input.question,
			options: input.options,
			answers: input.answers,
			scoringMode: input.scoringMode,
			topic: input.topic ?? null,
			explanation: input.explanation ?? null,
			deepExplanation: input.deepExplanation ?? null,
		})
		.where(eq(schema.questions.id, input.questionId));

	return true;
}

export async function batchInsertQuestions(
	db: AppDatabase,
	examId: string,
	questions: QuestionInsertInput[],
): Promise<BatchInsertQuestionsResult> {
	const seenNormalized = new Set<string>();
	let insertedCount = 0;
	let skippedDuplicateCount = 0;

	for (const question of questions) {
		const normalized = normalizeQuestionText(question.question);
		if (seenNormalized.has(normalized)) {
			skippedDuplicateCount += 1;
			continue;
		}
		seenNormalized.add(normalized);

		if (await existsNormalizedQuestion(db, examId, normalized)) {
			skippedDuplicateCount += 1;
			continue;
		}

		await insertQuestion(db, { ...question, examId });
		insertedCount += 1;
	}

	return { insertedCount, skippedDuplicateCount };
}
