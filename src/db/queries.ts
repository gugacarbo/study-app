import type { D1Database } from "@cloudflare/workers-types";
import {
	and,
	count,
	desc,
	eq,
	gte,
	like,
	lte,
	type SQL,
	sql,
} from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Question } from "../lib/validation";
import * as schema from "./schema";

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
	deepExplanation: string;
	topic: string;
}

export interface ExamFull {
	id: number;
	name: string;
	source: string | null;
	created_at: string | null;
	questionCount: number;
	topics: string[];
	files: FileInfo[];
	questions: ParsedQuestion[];
	stats: {
		totalQuestions: number;
		totalAttempts: number;
		correctAttempts: number;
		overallAccuracy: number;
		topicStats: TopicStats[];
	};
}

type DrizzleDB = DrizzleD1Database<typeof schema>;

export interface FileRecord {
	id: number;
	exam_id: number | null;
	name: string;
	r2_key: string;
	mime_type: string | null;
	size: number | null;
	created_at: string | null;
}

export interface FileInfo {
	id: number;
	exam_id: number | null;
	name: string;
	r2_key: string;
	mime_type: string | null;
	size: number | null;
	created_at: string | null;
}

export interface ExamDetail {
	id: number;
	name: string;
	source: string | null;
	created_at: string | null;
	questionCount: number;
	topics: string[];
	files: FileInfo[];
}

export interface LLMLogInsert {
	callId: string;
	callType: string;
	provider: string;
	model: string;
	baseUrl?: string;
	systemPrompt?: string;
	requestPayload?: string;
	responsePayload?: string;
	durationMs?: number;
	chunks?: number;
	finalChars?: number;
	tokenMeta?: string;
	errorMessage?: string;
	status?: "pending" | "success" | "failed" | "cancelled";
}

export interface PaginationMeta {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
	items: T[];
	pagination: PaginationMeta;
}

export interface ListExamsFilters {
	page?: number;
	pageSize?: number;
	nameContains?: string;
	source?: string;
	createdFrom?: string;
	createdTo?: string;
}

export interface ListQuestionsFilters {
	page?: number;
	pageSize?: number;
	examId?: number;
	topic?: string;
	textContains?: string;
	createdFrom?: string;
	createdTo?: string;
	includeAnswer?: boolean;
}

export interface ListAnswerKeysFilters {
	page?: number;
	pageSize?: number;
	examId?: number;
	questionId?: number;
	topic?: string;
	textContains?: string;
}

export interface ListAttemptsFilters {
	page?: number;
	pageSize?: number;
	examId?: number;
	questionId?: number;
	correct?: boolean;
	answeredFrom?: string;
	answeredTo?: string;
}

export interface QuestionListItem {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	explanation: string;
	deepExplanation: string;
	topic: string;
	created_at: string | null;
	answer?: string;
}

export interface AnswerKeyListItem {
	id: number;
	exam_id: number | null;
	topic: string | null;
	question: string;
	answer: string;
	created_at: string | null;
}

export interface AttemptListItem {
	id: number;
	question_id: number | null;
	user_answer: string;
	correct: boolean;
	timestamp: string | null;
	exam_id: number | null;
	question: string;
	topic: string | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function normalizePagination(input?: { page?: number; pageSize?: number }) {
	const pageRaw = Number(input?.page ?? 1);
	const pageSizeRaw = Number(input?.pageSize ?? DEFAULT_PAGE_SIZE);
	const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
	const pageSize = Number.isFinite(pageSizeRaw)
		? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw)))
		: DEFAULT_PAGE_SIZE;
	return { page, pageSize, offset: (page - 1) * pageSize };
}

function buildPaginationMeta(
	page: number,
	pageSize: number,
	totalItems: number,
): PaginationMeta {
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	return {
		page,
		pageSize,
		totalItems,
		totalPages,
		hasNextPage: page < totalPages,
		hasPrevPage: page > 1,
	};
}

function withWhere(conditions: SQL[]) {
	return conditions.length > 0 ? and(...conditions) : undefined;
}

export class DBQueries {
	private db: DrizzleDB;

	constructor(d1: D1Database) {
		this.db = drizzle(d1, { schema });
	}

	async insertFile(
		examId: number,
		name: string,
		r2Key: string,
		size: number,
		mimeType?: string,
	): Promise<number> {
		const result = await this.db
			.insert(schema.files)
			.values({
				exam_id: examId,
				name,
				r2_key: r2Key,
				mime_type: mimeType || null,
				size,
			})
			.returning({ id: schema.files.id })
			.get();

		return result?.id ?? 0;
	}

	async getFile(id: number): Promise<FileRecord | null> {
		const row = await this.db
			.select()
			.from(schema.files)
			.where(eq(schema.files.id, id))
			.get();

		return (row as FileRecord | undefined) ?? null;
	}

	async getFilesByExam(examId: number): Promise<FileInfo[]> {
		return await this.db
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

	async deleteFile(id: number): Promise<void> {
		await this.db.delete(schema.files).where(eq(schema.files.id, id)).run();
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

	async listExamsPaged(
		filters: ListExamsFilters = {},
	): Promise<PaginatedResult<ExamRecord>> {
		const { page, pageSize, offset } = normalizePagination(filters);
		const conditions: SQL[] = [];

		if (filters.nameContains) {
			conditions.push(like(schema.exams.name, `%${filters.nameContains}%`));
		}
		if (filters.source) {
			conditions.push(eq(schema.exams.source, filters.source));
		}
		if (filters.createdFrom) {
			conditions.push(gte(schema.exams.created_at, filters.createdFrom));
		}
		if (filters.createdTo) {
			conditions.push(lte(schema.exams.created_at, filters.createdTo));
		}

		const whereClause = withWhere(conditions);
		const total = await this.db
			.select({ count: count() })
			.from(schema.exams)
			.where(whereClause)
			.get();

		const items = await this.db
			.select()
			.from(schema.exams)
			.where(whereClause)
			.orderBy(desc(schema.exams.created_at), desc(schema.exams.id))
			.limit(pageSize)
			.offset(offset)
			.all();

		return {
			items,
			pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
		};
	}

	async getExamsDetailed(): Promise<ExamDetail[]> {
		const exams = await this.getExams();

		// Get question counts and topics per exam
		const examDetails = await this.db
			.select({
				exam_id: schema.questions.exam_id,
				questionCount: count(),
				topics: sql<string>`GROUP_CONCAT(DISTINCT ${schema.questions.topic})`,
			})
			.from(schema.questions)
			.groupBy(schema.questions.exam_id)
			.all();

		const examDetailMap = new Map(examDetails.map((e) => [e.exam_id, e]));

		// Get all files grouped by exam_id
		const allFiles = await this.db
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
			.all();

		const filesByExam = new Map<number, FileInfo[]>();
		for (const file of allFiles) {
			if (file.exam_id === null) continue;
			const list = filesByExam.get(file.exam_id) ?? [];
			list.push(file);
			filesByExam.set(file.exam_id, list);
		}

		return exams.map((exam) => ({
			...exam,
			questionCount: examDetailMap.get(exam.id)?.questionCount ?? 0,
			topics: (examDetailMap.get(exam.id)?.topics ?? "")
				.split(",")
				.filter(Boolean),
			files: filesByExam.get(exam.id) ?? [],
		}));
	}

	async getExamStats(examId: number): Promise<{
		totalQuestions: number;
		totalAttempts: number;
		correctAttempts: number;
		overallAccuracy: number;
		topicStats: TopicStats[];
	}> {
		const overall = await this.db
			.select({
				totalAttempts: count(schema.attempts.id),
				correctAttempts: sql<number>`COALESCE(SUM(${schema.attempts.correct}), 0)`,
			})
			.from(schema.questions)
			.leftJoin(
				schema.attempts,
				eq(schema.attempts.question_id, schema.questions.id),
			)
			.where(eq(schema.questions.exam_id, examId))
			.get();

		const totalQuestionsResult = await this.db
			.select({ count: count() })
			.from(schema.questions)
			.where(eq(schema.questions.exam_id, examId))
			.get();

		const topicResults = await this.db
			.select({
				topic: schema.questions.topic,
				total: count(schema.attempts.id),
				correct: sql<number>`COALESCE(SUM(${schema.attempts.correct}), 0)`,
			})
			.from(schema.questions)
			.leftJoin(
				schema.attempts,
				eq(schema.attempts.question_id, schema.questions.id),
			)
			.where(eq(schema.questions.exam_id, examId))
			.groupBy(schema.questions.topic)
			.all();

		const totalQuestions = totalQuestionsResult?.count ?? 0;
		const totalAttempts = overall?.totalAttempts ?? 0;
		const correctAttempts = overall?.correctAttempts ?? 0;

		return {
			totalQuestions,
			totalAttempts,
			correctAttempts,
			overallAccuracy:
				totalAttempts > 0
					? Math.round((correctAttempts / totalAttempts) * 100)
					: 0,
			topicStats: topicResults.map((t) => ({
				topic: t.topic ?? "General",
				total: t.total,
				correct: t.correct,
				accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
			})),
		};
	}

	async getExamFull(examId: number): Promise<ExamFull | null> {
		const exam = await this.getExamById(examId);
		if (!exam) return null;

		const questions = await this.getQuestionsByExam(examId);
		const files = await this.getFilesByExam(examId);
		const stats = await this.getExamStats(examId);

		const topics = [...new Set(questions.map((q) => q.topic).filter(Boolean))];

		return {
			...exam,
			questionCount: questions.length,
			topics,
			files,
			questions,
			stats,
		};
	}

	async deleteExam(id: number): Promise<void> {
		await this.db.delete(schema.exams).where(eq(schema.exams.id, id)).run();
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
					deep_explanation: q.deepExplanation || "",
					topic: q.topic || "General",
				})),
			)
			.run();
	}

	async updateQuestion(
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

		if (Object.keys(updates).length === 0) return;

		await this.db
			.update(schema.questions)
			.set(updates)
			.where(eq(schema.questions.id, id))
			.run();
	}

	async deleteQuestion(id: number): Promise<void> {
		await this.db
			.delete(schema.questions)
			.where(eq(schema.questions.id, id))
			.run();
	}

	async listQuestionsPaged(
		filters: ListQuestionsFilters = {},
	): Promise<PaginatedResult<QuestionListItem>> {
		const { page, pageSize, offset } = normalizePagination(filters);
		const conditions: SQL[] = [];

		if (filters.examId !== undefined) {
			conditions.push(eq(schema.questions.exam_id, filters.examId));
		}
		if (filters.topic) {
			conditions.push(eq(schema.questions.topic, filters.topic));
		}
		if (filters.textContains) {
			conditions.push(
				like(schema.questions.question, `%${filters.textContains}%`),
			);
		}
		if (filters.createdFrom) {
			conditions.push(gte(schema.questions.created_at, filters.createdFrom));
		}
		if (filters.createdTo) {
			conditions.push(lte(schema.questions.created_at, filters.createdTo));
		}

		const whereClause = withWhere(conditions);
		const includeAnswer = Boolean(filters.includeAnswer);
		const total = await this.db
			.select({ count: count() })
			.from(schema.questions)
			.where(whereClause)
			.get();

		if (includeAnswer) {
			const rows = await this.db
				.select({
					id: schema.questions.id,
					exam_id: schema.questions.exam_id,
					question: schema.questions.question,
					options: schema.questions.options,
					answer: schema.questions.answer,
					explanation: schema.questions.explanation,
					deep_explanation: schema.questions.deep_explanation,
					topic: schema.questions.topic,
					created_at: schema.questions.created_at,
				})
				.from(schema.questions)
				.where(whereClause)
				.orderBy(desc(schema.questions.created_at), desc(schema.questions.id))
				.limit(pageSize)
				.offset(offset)
				.all();

			return {
				items: rows.map((row) => ({
					id: row.id,
					exam_id: row.exam_id,
					question: row.question,
					options: JSON.parse(row.options) as string[],
					answer: row.answer,
					explanation: row.explanation ?? "",
					deepExplanation: row.deep_explanation ?? "",
					topic: row.topic ?? "",
					created_at: row.created_at,
				})),
				pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
			};
		}

		const rows = await this.db
			.select({
				id: schema.questions.id,
				exam_id: schema.questions.exam_id,
				question: schema.questions.question,
				options: schema.questions.options,
				explanation: schema.questions.explanation,
				deep_explanation: schema.questions.deep_explanation,
				topic: schema.questions.topic,
				created_at: schema.questions.created_at,
			})
			.from(schema.questions)
			.where(whereClause)
			.orderBy(desc(schema.questions.created_at), desc(schema.questions.id))
			.limit(pageSize)
			.offset(offset)
			.all();

		return {
			items: rows.map((row) => ({
				id: row.id,
				exam_id: row.exam_id,
				question: row.question,
				options: JSON.parse(row.options) as string[],
				explanation: row.explanation ?? "",
				deepExplanation: row.deep_explanation ?? "",
				topic: row.topic ?? "",
				created_at: row.created_at,
			})),
			pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
		};
	}

	async listAnswerKeysPaged(
		filters: ListAnswerKeysFilters = {},
	): Promise<PaginatedResult<AnswerKeyListItem>> {
		const { page, pageSize, offset } = normalizePagination(filters);
		const conditions: SQL[] = [];

		if (filters.examId !== undefined) {
			conditions.push(eq(schema.questions.exam_id, filters.examId));
		}
		if (filters.questionId !== undefined) {
			conditions.push(eq(schema.questions.id, filters.questionId));
		}
		if (filters.topic) {
			conditions.push(eq(schema.questions.topic, filters.topic));
		}
		if (filters.textContains) {
			conditions.push(
				like(schema.questions.question, `%${filters.textContains}%`),
			);
		}

		const whereClause = withWhere(conditions);
		const total = await this.db
			.select({ count: count() })
			.from(schema.questions)
			.where(whereClause)
			.get();

		const items = await this.db
			.select({
				id: schema.questions.id,
				exam_id: schema.questions.exam_id,
				topic: schema.questions.topic,
				question: schema.questions.question,
				answer: schema.questions.answer,
				created_at: schema.questions.created_at,
			})
			.from(schema.questions)
			.where(whereClause)
			.orderBy(desc(schema.questions.created_at), desc(schema.questions.id))
			.limit(pageSize)
			.offset(offset)
			.all();

		return {
			items,
			pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
		};
	}

	async listAttemptsPaged(
		filters: ListAttemptsFilters = {},
	): Promise<PaginatedResult<AttemptListItem>> {
		const { page, pageSize, offset } = normalizePagination(filters);
		const conditions: SQL[] = [];

		if (filters.examId !== undefined) {
			conditions.push(eq(schema.questions.exam_id, filters.examId));
		}
		if (filters.questionId !== undefined) {
			conditions.push(eq(schema.attempts.question_id, filters.questionId));
		}
		if (filters.correct !== undefined) {
			conditions.push(eq(schema.attempts.correct, filters.correct));
		}
		if (filters.answeredFrom) {
			conditions.push(gte(schema.attempts.timestamp, filters.answeredFrom));
		}
		if (filters.answeredTo) {
			conditions.push(lte(schema.attempts.timestamp, filters.answeredTo));
		}

		const whereClause = withWhere(conditions);
		const total = await this.db
			.select({ count: count() })
			.from(schema.attempts)
			.innerJoin(
				schema.questions,
				eq(schema.attempts.question_id, schema.questions.id),
			)
			.where(whereClause)
			.get();

		const rows = await this.db
			.select({
				id: schema.attempts.id,
				question_id: schema.attempts.question_id,
				user_answer: schema.attempts.user_answer,
				correct: schema.attempts.correct,
				timestamp: schema.attempts.timestamp,
				exam_id: schema.questions.exam_id,
				question: schema.questions.question,
				topic: schema.questions.topic,
			})
			.from(schema.attempts)
			.innerJoin(
				schema.questions,
				eq(schema.attempts.question_id, schema.questions.id),
			)
			.where(whereClause)
			.orderBy(desc(schema.attempts.timestamp), desc(schema.attempts.id))
			.limit(pageSize)
			.offset(offset)
			.all();

		return {
			items: rows.map((row) => ({
				id: row.id,
				question_id: row.question_id,
				user_answer: row.user_answer,
				correct: Boolean(row.correct),
				timestamp: row.timestamp,
				exam_id: row.exam_id,
				question: row.question,
				topic: row.topic,
			})),
			pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
		};
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
			deepExplanation: r.deep_explanation ?? "",
			topic: r.topic ?? "",
		}));
	}

	async getQuestionById(questionId: number): Promise<ParsedQuestion | null> {
		const row = await this.db
			.select()
			.from(schema.questions)
			.where(eq(schema.questions.id, questionId))
			.get();

		if (!row) return null;

		return {
			...row,
			options: JSON.parse(row.options) as string[],
			explanation: row.explanation ?? "",
			deepExplanation: row.deep_explanation ?? "",
			topic: row.topic ?? "",
		};
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
			deepExplanation: r.deep_explanation ?? "",
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

	async insertLLMLog(log: LLMLogInsert): Promise<void> {
		await this.db
			.insert(schema.llmLogs)
			.values({
				call_id: log.callId,
				call_type: log.callType,
				provider: log.provider,
				model: log.model,
				base_url: log.baseUrl ?? null,
				system_prompt: log.systemPrompt ?? null,
				request_payload: log.requestPayload ?? null,
				response_payload: log.responsePayload ?? null,
				duration_ms: log.durationMs ?? null,
				chunks: log.chunks ?? null,
				final_chars: log.finalChars ?? null,
				token_meta: log.tokenMeta ?? null,
				error_message: log.errorMessage ?? null,
				status: log.status ?? "pending",
			})
			.onConflictDoUpdate({
				target: schema.llmLogs.call_id,
				set: {
					call_type: log.callType,
					provider: log.provider,
					model: log.model,
					base_url: log.baseUrl ?? null,
					system_prompt: log.systemPrompt ?? null,
					request_payload: log.requestPayload ?? null,
					response_payload: log.responsePayload ?? null,
					duration_ms: log.durationMs ?? null,
					chunks: log.chunks ?? null,
					final_chars: log.finalChars ?? null,
					token_meta: log.tokenMeta ?? null,
					error_message: log.errorMessage ?? null,
					status: log.status ?? "pending",
				},
			})
			.run();
	}
}
