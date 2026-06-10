import type { D1Database } from "@cloudflare/workers-types";
import { count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import { buildPaginationMeta, normalizePagination, withWhere } from "./helpers";
import type {
	AttemptListItem,
	AttemptStatus,
	ListAttemptsFilters,
	PaginatedResult,
} from "./types";

function serializeUserAnswers(userAnswers: string[]): string {
	return userAnswers.length === 1
		? userAnswers[0]
		: JSON.stringify(userAnswers);
}

export function createAttemptSession(
	this: DBQueries,
	input: { examId?: number; topic?: string; totalQuestions: number },
): Promise<number> {
	return this.d1
		.prepare(
			`INSERT INTO attempts (
				exam_id, topic, total_questions, answered_questions, correct_answers,
				status, started_at, completed_at, updated_at
			) VALUES (?, ?, ?, 0, 0, 'in_progress', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)`,
		)
		.bind(input.examId ?? null, input.topic ?? null, input.totalQuestions)
		.run()
		.then((result) => Number(result.meta.last_row_id ?? 0));
}

export function abandonInProgressAttempts(
	this: DBQueries,
	input: { examId?: number; topic?: string },
): Promise<void> {
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

	return this.d1
		.prepare(
			`UPDATE attempts
			 SET status = ?, completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
			 WHERE ${conditions.join(" AND ")}`,
		)
		.bind("abandoned", ...params)
		.run()
		.then(() => undefined);
}

export function upsertAttemptAnswer(
	this: DBQueries,
	input: {
		attemptId: number;
		questionId: number;
		userAnswers: string[];
		correct: boolean;
		credit: number;
	},
): Promise<void> {
	return this.d1
		.prepare(
			`INSERT INTO attempt_answers (
				attempt_id, question_id, user_answer, correct, credit, answered_at
			) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(attempt_id, question_id) DO UPDATE SET
				user_answer = excluded.user_answer,
				correct = excluded.correct,
				credit = excluded.credit,
				answered_at = CURRENT_TIMESTAMP`,
		)
		.bind(
			input.attemptId,
			input.questionId,
			serializeUserAnswers(input.userAnswers),
			Number(input.correct),
			input.credit,
		)
		.run()
		.then(() => undefined);
}

export function refreshAttemptProgress(
	this: DBQueries,
	attemptId: number,
): Promise<void> {
	return (this.d1 as D1Database)
		.prepare(
			`UPDATE attempts
			 SET answered_questions = (
			 	SELECT COUNT(*)
			 	FROM attempt_answers
			 	WHERE attempt_id = attempts.id
			 ),
			 correct_answers = COALESCE((
			 	SELECT SUM(credit)
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
		.run()
		.then(() => undefined);
}

export function getAttemptById(
	this: DBQueries,
	attemptId: number,
): Promise<AttemptListItem | null> {
	return this.db
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
		.get()
		.then((row) => {
			if (!row) return null;
			return {
				...row,
				status: row.status as AttemptStatus,
				accuracy:
					row.answered_questions > 0
						? Math.round((row.correct_answers / row.answered_questions) * 100)
						: 0,
			};
		});
}

export function listAttemptsPaged(
	this: DBQueries,
	filters: ListAttemptsFilters = {},
): Promise<PaginatedResult<AttemptListItem>> {
	const { page, pageSize, offset } = normalizePagination(filters);
	const conditions: SQL[] = [];

	if (filters.examId !== undefined) {
		conditions.push(eq(schema.attempts.exam_id, filters.examId));
	}
	if (filters.topic !== undefined) {
		conditions.push(eq(schema.attempts.topic, filters.topic));
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
	const totalPromise = this.db
		.select({ count: count() })
		.from(schema.attempts)
		.where(whereClause)
		.get();

	const itemsPromise = this.db
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

	return Promise.all([totalPromise, itemsPromise]).then(([total, rows]) => ({
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
	}));
}
