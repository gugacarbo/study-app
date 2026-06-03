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

export interface TopicStats {
	topic: string;
	attempts: number;
	completedAnswers: number;
	correctAnswers: number;
	accuracy: number;
}

export type AttemptStatus = "in_progress" | "completed" | "abandoned";

export interface AttemptStatsSummary {
	totalAttempts: number;
	completedAttempts: number;
	incompleteAttempts: number;
	correctAnswers: number;
	answeredQuestions: number;
	overallAccuracy: number;
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
	stats: AttemptStatsSummary & {
		totalQuestions: number;
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

interface PaginationMeta {
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
	status?: AttemptStatus;
	startedFrom?: string;
	startedTo?: string;
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
	exam_id: number | null;
	topic: string | null;
	total_questions: number;
	answered_questions: number;
	correct_answers: number;
	status: AttemptStatus;
	started_at: string | null;
	completed_at: string | null;
	updated_at: string | null;
	accuracy: number;
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
	private d1: D1Database;

	constructor(d1: D1Database) {
		this.d1 = d1;
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
		completedAttempts: number;
		incompleteAttempts: number;
		correctAnswers: number;
		answeredQuestions: number;
		overallAccuracy: number;
		topicStats: TopicStats[];
	}> {
		const overall = await this.db
			.select({
				totalAttempts: count(schema.attempts.id),
				completedAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
				incompleteAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} != 'completed' THEN 1 ELSE 0 END), 0)`,
			})
			.from(schema.attempts)
			.where(eq(schema.attempts.exam_id, examId))
			.get();

		const answerTotals = await this.db
			.select({
				answeredQuestions: count(schema.attemptAnswers.id),
				correctAnswers: sql<number>`COALESCE(SUM(${schema.attemptAnswers.correct}), 0)`,
			})
			.from(schema.attemptAnswers)
			.innerJoin(
				schema.attempts,
				eq(schema.attemptAnswers.attempt_id, schema.attempts.id),
			)
			.innerJoin(
				schema.questions,
				eq(schema.attemptAnswers.question_id, schema.questions.id),
			)
			.where(
				and(
					eq(schema.questions.exam_id, examId),
					eq(schema.attempts.status, "completed"),
				),
			)
			.get();

		const totalQuestionsResult = await this.db
			.select({ count: count() })
			.from(schema.questions)
			.where(eq(schema.questions.exam_id, examId))
			.get();

		const topicResults = await this.db
			.select({
				topic: schema.questions.topic,
				attempts: sql<number>`COUNT(DISTINCT ${schema.attemptAnswers.attempt_id})`,
				completedAnswers: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
				correctAnswers: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN ${schema.attemptAnswers.correct} ELSE 0 END), 0)`,
			})
			.from(schema.questions)
			.leftJoin(
				schema.attemptAnswers,
				eq(schema.attemptAnswers.question_id, schema.questions.id),
			)
			.leftJoin(
				schema.attempts,
				eq(schema.attemptAnswers.attempt_id, schema.attempts.id),
			)
			.where(eq(schema.questions.exam_id, examId))
			.groupBy(schema.questions.topic)
			.all();

		const totalQuestions = totalQuestionsResult?.count ?? 0;
		const totalAttempts = overall?.totalAttempts ?? 0;
		const completedAttempts = overall?.completedAttempts ?? 0;
		const incompleteAttempts = overall?.incompleteAttempts ?? 0;
		const answeredQuestions = answerTotals?.answeredQuestions ?? 0;
		const correctAnswers = answerTotals?.correctAnswers ?? 0;

		return {
			totalQuestions,
			totalAttempts,
			completedAttempts,
			incompleteAttempts,
			correctAnswers,
			answeredQuestions,
			overallAccuracy:
				answeredQuestions > 0
					? Math.round((correctAnswers / answeredQuestions) * 100)
					: 0,
			topicStats: topicResults.map((t) => ({
				topic: t.topic ?? "General",
				attempts: t.attempts,
				completedAnswers: t.completedAnswers,
				correctAnswers: t.correctAnswers,
				accuracy:
					t.completedAnswers > 0
						? Math.round((t.correctAnswers / t.completedAnswers) * 100)
						: 0,
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

		// Insert one-by-one to avoid D1/SQLite bug where bulk insert
		// generates `id = null` in the VALUES clause, which fails with
		// PRIMARY KEY AUTOINCREMENT.
		for (const q of questions) {
			await this.db
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
				.run();
		}
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
			conditions.push(eq(schema.attempts.exam_id, filters.examId));
		}
		if (filters.status !== undefined) {
			conditions.push(eq(schema.attempts.status, filters.status));
		}
		if (filters.startedFrom) {
			conditions.push(gte(schema.attempts.started_at, filters.startedFrom));
		}
		if (filters.startedTo) {
			conditions.push(lte(schema.attempts.started_at, filters.startedTo));
		}

		const whereClause = withWhere(conditions);
		const total = await this.db
			.select({ count: count() })
			.from(schema.attempts)
			.where(whereClause)
			.get();

		const rows = await this.db
			.select({
				id: schema.attempts.id,
				exam_id: schema.attempts.exam_id,
				topic: schema.attempts.topic,
				total_questions: schema.attempts.total_questions,
				answered_questions: schema.attempts.answered_questions,
				correct_answers: schema.attempts.correct_answers,
				status: schema.attempts.status,
				started_at: schema.attempts.started_at,
				completed_at: schema.attempts.completed_at,
				updated_at: schema.attempts.updated_at,
			})
			.from(schema.attempts)
			.where(whereClause)
			.orderBy(desc(schema.attempts.started_at), desc(schema.attempts.id))
			.limit(pageSize)
			.offset(offset)
			.all();

		return {
			items: rows.map((row) => ({
				id: row.id,
				exam_id: row.exam_id,
				topic: row.topic,
				total_questions: row.total_questions,
				answered_questions: row.answered_questions,
				correct_answers: row.correct_answers,
				status: row.status as AttemptStatus,
				started_at: row.started_at,
				completed_at: row.completed_at,
				updated_at: row.updated_at,
				accuracy:
					row.answered_questions > 0
						? Math.round((row.correct_answers / row.answered_questions) * 100)
						: 0,
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

	async createAttemptSession(input: {
		examId?: number;
		topic?: string;
		totalQuestions: number;
	}): Promise<number> {
		const result = await this.d1
			.prepare(
				`INSERT INTO attempts (
					exam_id, topic, total_questions, answered_questions, correct_answers,
					status, started_at, completed_at, updated_at
				) VALUES (?, ?, ?, 0, 0, 'in_progress', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)`,
			)
			.bind(input.examId ?? null, input.topic ?? null, input.totalQuestions)
			.run();

		return Number(result.meta.last_row_id ?? 0);
	}

	async abandonInProgressAttempts(input: {
		examId?: number;
		topic?: string;
	}): Promise<void> {
		const conditions = [`status = 'in_progress'`];
		const params: Array<number | string> = [];

		if (input.examId === undefined) {
			conditions.push("exam_id IS NULL");
		} else {
			conditions.push("exam_id = ?");
			params.push(input.examId);
		}

		if (input.topic === undefined) {
			conditions.push("topic IS NULL");
		} else {
			conditions.push("topic = ?");
			params.push(input.topic);
		}

		await this.d1
			.prepare(
				`UPDATE attempts
				 SET status = ?, completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
				 WHERE ${conditions.join(" AND ")}`,
			)
			.bind("abandoned", ...params)
			.run();
	}

	async upsertAttemptAnswer(input: {
		attemptId: number;
		questionId: number;
		userAnswer: string;
		correct: boolean;
	}): Promise<void> {
		await this.d1
			.prepare(
				`INSERT INTO attempt_answers (
					attempt_id, question_id, user_answer, correct, answered_at
				) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(attempt_id, question_id) DO UPDATE SET
					user_answer = excluded.user_answer,
					correct = excluded.correct,
					answered_at = CURRENT_TIMESTAMP`,
			)
			.bind(
				input.attemptId,
				input.questionId,
				input.userAnswer,
				Number(input.correct),
			)
			.run();
	}

	async refreshAttemptProgress(attemptId: number): Promise<void> {
		await this.d1
			.prepare(
				`UPDATE attempts
				 SET answered_questions = (
				 	SELECT COUNT(*)
				 	FROM attempt_answers
				 	WHERE attempt_id = attempts.id
				 ),
				 correct_answers = COALESCE((
				 	SELECT SUM(correct)
				 	FROM attempt_answers
				 	WHERE attempt_id = attempts.id
				 ), 0),
				 status = CASE
				 	WHEN (
				 		SELECT COUNT(*)
				 		FROM attempt_answers
				 		WHERE attempt_id = attempts.id
				 	) >= total_questions THEN 'completed'
				 	ELSE 'in_progress'
				 END,
				 completed_at = CASE
				 	WHEN (
				 		SELECT COUNT(*)
				 		FROM attempt_answers
				 		WHERE attempt_id = attempts.id
				 	) >= total_questions THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
				 	ELSE NULL
				 END,
				 updated_at = CURRENT_TIMESTAMP
				 WHERE id = ?`,
			)
			.bind(attemptId)
			.run();
	}

	async getAttemptById(attemptId: number): Promise<AttemptListItem | null> {
		const row = await this.db
			.select({
				id: schema.attempts.id,
				exam_id: schema.attempts.exam_id,
				topic: schema.attempts.topic,
				total_questions: schema.attempts.total_questions,
				answered_questions: schema.attempts.answered_questions,
				correct_answers: schema.attempts.correct_answers,
				status: schema.attempts.status,
				started_at: schema.attempts.started_at,
				completed_at: schema.attempts.completed_at,
				updated_at: schema.attempts.updated_at,
			})
			.from(schema.attempts)
			.where(eq(schema.attempts.id, attemptId))
			.get();

		if (!row) return null;

		return {
			...row,
			status: row.status as AttemptStatus,
			accuracy:
				row.answered_questions > 0
					? Math.round((row.correct_answers / row.answered_questions) * 100)
					: 0,
		};
	}

	async getStats(): Promise<AttemptStatsSummary & { topics: TopicStats[] }> {
		const totals = await this.db
			.select({
				totalAttempts: count(schema.attempts.id),
				completedAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
				incompleteAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} != 'completed' THEN 1 ELSE 0 END), 0)`,
			})
			.from(schema.attempts)
			.get();

		const answerTotals = await this.db
			.select({
				answeredQuestions: count(schema.attemptAnswers.id),
				correctAnswers: sql<number>`COALESCE(SUM(${schema.attemptAnswers.correct}), 0)`,
			})
			.from(schema.attemptAnswers)
			.innerJoin(
				schema.attempts,
				eq(schema.attemptAnswers.attempt_id, schema.attempts.id),
			)
			.where(eq(schema.attempts.status, "completed"))
			.get();

		const topicsResult = await this.db
			.select({
				topic: schema.questions.topic,
				attempts: sql<number>`COUNT(DISTINCT ${schema.attemptAnswers.attempt_id})`,
				completedAnswers: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
				correctAnswers: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN ${schema.attemptAnswers.correct} ELSE 0 END), 0)`,
			})
			.from(schema.questions)
			.leftJoin(
				schema.attemptAnswers,
				eq(schema.attemptAnswers.question_id, schema.questions.id),
			)
			.innerJoin(
				schema.attempts,
				eq(schema.attemptAnswers.attempt_id, schema.attempts.id),
			)
			.groupBy(schema.questions.topic)
			.all();

		const totalAttempts = totals?.totalAttempts ?? 0;
		const completedAttempts = totals?.completedAttempts ?? 0;
		const incompleteAttempts = totals?.incompleteAttempts ?? 0;
		const answeredQuestions = answerTotals?.answeredQuestions ?? 0;
		const correctAnswers = answerTotals?.correctAnswers ?? 0;

		return {
			totalAttempts,
			completedAttempts,
			incompleteAttempts,
			correctAnswers,
			answeredQuestions,
			overallAccuracy:
				answeredQuestions > 0
					? Math.round((correctAnswers / answeredQuestions) * 100)
					: 0,
			topics: topicsResult.map((t) => ({
				topic: t.topic ?? "General",
				attempts: t.attempts,
				completedAnswers: t.completedAnswers,
				correctAnswers: t.correctAnswers,
				accuracy:
					t.completedAnswers > 0
						? Math.round((t.correctAnswers / t.completedAnswers) * 100)
						: 0,
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
