import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, sql, count } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";
import type { Question } from "../lib/validation";

export interface ExamRecord {
	id: number;
	name: string;
	source: string | null;
	created_at: string | null;
}

export interface AttemptRecord {
	id: number;
	question_id: number | null;
	user_answer: string;
	correct: number; // 0 | 1 in SQLite
	timestamp: string | null;
}

export interface TopicStats {
	topic: string;
	total: number;
	correct: number;
	accuracy: number;
}

interface ParsedQuestion {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	answer: string;
	explanation: string;
	topic: string;
}

type DrizzleDB = DrizzleD1Database<typeof schema>;

export class DBQueries {
	private db: DrizzleDB;

	constructor(d1: D1Database) {
		this.db = drizzle(d1, { schema });
	}

	async insertExam(name: string, source?: string): Promise<number> {
		const result = await this.db
			.insert(schema.exams)
			.values({ name, source: source || null })
			.returning({ id: schema.exams.id })
			.get();

		return result?.id ?? 0;
	}

	async getExamById(id: number): Promise<ExamRecord | null> {
		return (
			(await this.db
				.select()
				.from(schema.exams)
				.where(eq(schema.exams.id, id))
				.get()) ?? null
		);
	}

	async getExams(): Promise<ExamRecord[]> {
		return await this.db
			.select()
			.from(schema.exams)
			.orderBy(sql`created_at DESC`)
			.all();
	}

	async insertQuestions(examId: number, questions: Question[]): Promise<void> {
		if (questions.length === 0) return;

		await this.db
			.insert(schema.questions)
			.values(
				questions.map((q) => ({
					exam_id: examId,
					question: q.question,
					options: JSON.stringify(q.options),
					answer: q.answer,
					explanation: q.explanation || "",
					topic: q.topic || "General",
				})),
			)
			.run();
	}

	async getQuestionsByExam(examId: number): Promise<ParsedQuestion[]> {
		const rows = await this.db
			.select()
			.from(schema.questions)
			.where(eq(schema.questions.exam_id, examId))
			.orderBy(schema.questions.id)
			.all();

		return rows.map((r) => ({
			...r,
			options: JSON.parse(r.options) as string[],
			explanation: r.explanation ?? "",
			topic: r.topic ?? "",
		}));
	}

	async getRandomQuestions(
		limit: number,
		topic?: string,
	): Promise<ParsedQuestion[]> {
		const conditions = topic ? [eq(schema.questions.topic, topic)] : [];

		const rows = await this.db
			.select()
			.from(schema.questions)
			.where(and(...conditions))
			.orderBy(sql`RANDOM()`)
			.limit(limit)
			.all();

		return rows.map((r) => ({
			...r,
			options: JSON.parse(r.options) as string[],
			explanation: r.explanation ?? "",
			topic: r.topic ?? "",
		}));
	}

	async recordAttempt(
		questionId: number,
		userAnswer: string,
		correct: boolean,
	): Promise<void> {
		await this.db
			.insert(schema.attempts)
			.values({ question_id: questionId, user_answer: userAnswer, correct })
			.run();
	}

	async getStats(): Promise<{ totalAttempts: number; topics: TopicStats[] }> {
		const totalResult = await this.db
			.select({ count: count() })
			.from(schema.attempts)
			.get();

		const topicsResult = await this.db
			.select({
				topic: schema.questions.topic,
				total: count(),
				correct: sql<number>`SUM(${schema.attempts.correct})`,
			})
			.from(schema.attempts)
			.innerJoin(
				schema.questions,
				eq(schema.attempts.question_id, schema.questions.id),
			)
			.groupBy(schema.questions.topic)
			.all();

		return {
			totalAttempts: totalResult?.count ?? 0,
			topics: topicsResult.map((t) => ({
				topic: t.topic ?? "General",
				total: t.total,
				correct: t.correct ?? 0,
				accuracy: t.total ? Math.round(((t.correct ?? 0) / t.total) * 100) : 0,
			})),
		};
	}

	async getConfig(key: string): Promise<string | null> {
		const result = await this.db
			.select()
			.from(schema.config)
			.where(eq(schema.config.key, key))
			.get();

		return result?.value ?? null;
	}

	async setConfig(key: string, value: string): Promise<void> {
		await this.db
			.insert(schema.config)
			.values({ key, value })
			.onConflictDoUpdate({ target: schema.config.key, set: { value } })
			.run();
	}

	async getAllConfig(): Promise<Record<string, string>> {
		const rows = await this.db.select().from(schema.config).all();

		return Object.fromEntries(rows.map((r) => [r.key, r.value]));
	}
}
