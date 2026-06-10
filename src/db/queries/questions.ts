import { and, eq, sql } from "drizzle-orm";
import type { Question } from "../../lib/validation";
import * as schema from "../schema";
import type { DBQueries } from "./base";

function parseAnswersJson(value: string): string[] {
	const parsed: unknown = JSON.parse(value);
	if (!Array.isArray(parsed)) return [];
	return parsed.filter((entry): entry is string => typeof entry === "string");
}

function mapQuestionRow<
	TRow extends {
		options: string;
		answers: string;
		scoring_mode: string;
		explanation: string | null;
		deep_explanation: string | null;
		topic: string | null;
	},
>(row: TRow) {
	return {
		...row,
		options: JSON.parse(row.options) as string[],
		answers: parseAnswersJson(row.answers),
		scoringMode:
			row.scoring_mode === "partial"
				? ("partial" as const)
				: ("exact" as const),
		explanation: row.explanation ?? "",
		deepExplanation: row.deep_explanation ?? "",
		topic: row.topic ?? "",
	};
}

export function insertQuestions(
	this: DBQueries,
	examId: number,
	questions: Question[],
): Promise<void> {
	if (questions.length === 0) return Promise.resolve();

	const inserts = questions.map((q) =>
		this.db
			.insert(schema.questions)
			.values({
				exam_id: examId,
				question: q.question,
				options: JSON.stringify(q.options),
				answers: JSON.stringify(q.answers),
				scoring_mode: q.scoringMode,
				explanation: q.explanation || "",
				deep_explanation: q.deepExplanation || "",
				topic: q.topic || "General",
			})
			.run(),
	);

	return Promise.all(inserts).then(() => undefined);
}

export function updateQuestion(
	this: DBQueries,
	id: number,
	data: {
		question?: string;
		options?: string[];
		answers?: string[];
		scoringMode?: "exact" | "partial";
		explanation?: string;
		deepExplanation?: string;
		topic?: string;
	},
): Promise<void> {
	const updates: Record<string, unknown> = {};
	if (data.question !== undefined) updates.question = data.question;
	if (data.options !== undefined)
		updates.options = JSON.stringify(data.options);
	if (data.answers !== undefined)
		updates.answers = JSON.stringify(data.answers);
	if (data.scoringMode !== undefined) updates.scoring_mode = data.scoringMode;
	if (data.explanation !== undefined) updates.explanation = data.explanation;
	if (data.deepExplanation !== undefined) {
		updates.deep_explanation = data.deepExplanation;
	}
	if (data.topic !== undefined) updates.topic = data.topic;

	if (Object.keys(updates).length === 0) return Promise.resolve();

	return this.db
		.update(schema.questions)
		.set(updates)
		.where(eq(schema.questions.id, id))
		.run()
		.then(() => undefined);
}

export function deleteQuestion(this: DBQueries, id: number): Promise<void> {
	return this.db
		.delete(schema.questions)
		.where(eq(schema.questions.id, id))
		.run()
		.then(() => undefined);
}

export function getQuestionsByExam(this: DBQueries, examId: number) {
	return this.db
		.select()
		.from(schema.questions)
		.where(eq(schema.questions.exam_id, examId))
		.orderBy(schema.questions.id)
		.all()
		.then((rows) => rows.map(mapQuestionRow));
}

export function getQuestionById(this: DBQueries, questionId: number) {
	return this.db
		.select()
		.from(schema.questions)
		.where(eq(schema.questions.id, questionId))
		.get()
		.then((row) => (row ? mapQuestionRow(row) : null));
}

export function getRandomQuestions(
	this: DBQueries,
	limit: number,
	topic?: string,
) {
	const conditions = topic ? [eq(schema.questions.topic, topic)] : [];

	return this.db
		.select()
		.from(schema.questions)
		.where(and(...conditions))
		.orderBy(sql`RANDOM()`)
		.limit(limit)
		.all()
		.then((rows) => rows.map(mapQuestionRow));
}
