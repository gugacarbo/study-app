import { and, eq, sql } from "drizzle-orm";
import type { Question } from "../../lib/validation";
import * as schema from "../schema";
import type { DBQueries } from "./base";

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
				answer: q.answer,
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
		answer?: string;
		explanation?: string;
		deepExplanation?: string;
		topic?: string;
	},
): Promise<void> {
	const updates: Record<string, unknown> = {};
	if (data.question !== undefined) updates.question = data.question;
	if (data.options !== undefined)
		updates.options = JSON.stringify(data.options);
	if (data.answer !== undefined) updates.answer = data.answer;
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
		.then((rows) =>
			rows.map((r) => ({
				...r,
				options: JSON.parse(r.options) as string[],
				explanation: r.explanation ?? "",
				deepExplanation: r.deep_explanation ?? "",
				topic: r.topic ?? "",
			})),
		);
}

export function getQuestionById(this: DBQueries, questionId: number) {
	return this.db
		.select()
		.from(schema.questions)
		.where(eq(schema.questions.id, questionId))
		.get()
		.then((row) => {
			if (!row) return null;
			return {
				...row,
				options: JSON.parse(row.options) as string[],
				explanation: row.explanation ?? "",
				deepExplanation: row.deep_explanation ?? "",
				topic: row.topic ?? "",
			};
		});
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
		.then((rows) =>
			rows.map((r) => ({
				...r,
				options: JSON.parse(r.options) as string[],
				explanation: r.explanation ?? "",
				deepExplanation: r.deep_explanation ?? "",
				topic: r.topic ?? "",
			})),
		);
}
