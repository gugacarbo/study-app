import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type AttemptRow = typeof schema.attempts.$inferSelect;
export type AttemptAnswerRow = typeof schema.attemptAnswers.$inferSelect;
export type ExamTopicOption = { id: string; name: string };

export type QuizConfig = {
	order: "original" | "random";
	quantity: number;
	topicFilter: string | null;
	revealMode: "during" | "after";
};

export type CreateAttemptInput = {
	id: string;
	userId: string;
	examId: string;
	config: QuizConfig;
	totalQuestions: number;
};

function serializeConfig(config: QuizConfig): string {
	return JSON.stringify(config);
}

export function parseConfig(configJson: string | null): QuizConfig {
	if (!configJson) {
		return {
			order: "original",
			quantity: 0,
			topicFilter: null,
			revealMode: "after",
		};
	}
	const parsed = JSON.parse(configJson) as Partial<QuizConfig>;
	return {
		order: parsed.order === "random" ? "random" : "original",
		quantity: typeof parsed.quantity === "number" ? parsed.quantity : 0,
		topicFilter: parsed.topicFilter ?? null,
		revealMode: parsed.revealMode === "during" ? "during" : "after",
	};
}

export async function createAttempt(
	db: AppDatabase,
	input: CreateAttemptInput,
): Promise<AttemptRow> {
	await db.insert(schema.attempts).values({
		id: input.id,
		userId: input.userId,
		examId: input.examId,
		config: serializeConfig(input.config),
		totalQuestions: input.totalQuestions,
		answeredQuestions: 0,
		correctAnswers: 0,
		status: "in_progress",
	});

	const rows = await db
		.select()
		.from(schema.attempts)
		.where(eq(schema.attempts.id, input.id))
		.limit(1);

	return rows[0];
}

export async function getAttemptById(
	db: AppDatabase,
	attemptId: string,
	userId: string,
): Promise<AttemptRow | null> {
	const rows = await db
		.select()
		.from(schema.attempts)
		.where(
			and(eq(schema.attempts.id, attemptId), eq(schema.attempts.userId, userId)),
		)
		.limit(1);
	return rows[0] ?? null;
}

export async function findAttemptById(
	db: AppDatabase,
	attemptId: string,
): Promise<AttemptRow | null> {
	const rows = await db
		.select()
		.from(schema.attempts)
		.where(eq(schema.attempts.id, attemptId))
		.limit(1);
	return rows[0] ?? null;
}

export async function findActiveAttemptByExamId(
	db: AppDatabase,
	userId: string,
	examId: string,
): Promise<AttemptRow | null> {
	const rows = await db
		.select()
		.from(schema.attempts)
		.where(
			and(
				eq(schema.attempts.userId, userId),
				eq(schema.attempts.examId, examId),
				eq(schema.attempts.status, "in_progress"),
			),
		)
		.orderBy(sql`${schema.attempts.startedAt} DESC`)
		.limit(1);
	return rows[0] ?? null;
}

export async function getAttemptAnswers(
	db: AppDatabase,
	attemptId: string,
): Promise<AttemptAnswerRow[]> {
	return db
		.select()
		.from(schema.attemptAnswers)
		.where(eq(schema.attemptAnswers.attemptId, attemptId));
}

export async function getAttemptAnswerByQuestionId(
	db: AppDatabase,
	attemptId: string,
	questionId: string,
): Promise<AttemptAnswerRow | null> {
	const rows = await db
		.select()
		.from(schema.attemptAnswers)
		.where(
			and(
				eq(schema.attemptAnswers.attemptId, attemptId),
				eq(schema.attemptAnswers.questionId, questionId),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

export async function recordAttemptAnswer(
	db: AppDatabase,
	input: {
		attemptId: string;
		questionId: string;
		userAnswer: string;
		correct: boolean;
		credit: number;
	},
): Promise<AttemptAnswerRow> {
	const existing = await getAttemptAnswerByQuestionId(
		db,
		input.attemptId,
		input.questionId,
	);

	if (existing) {
		await db
			.update(schema.attemptAnswers)
			.set({
				userAnswer: input.userAnswer,
				correct: input.correct,
				credit: input.credit,
				answeredAt: sql`CURRENT_TIMESTAMP`,
			})
			.where(eq(schema.attemptAnswers.id, existing.id));
	} else {
		const id = crypto.randomUUID();
		await db.insert(schema.attemptAnswers).values({
			id,
			attemptId: input.attemptId,
			questionId: input.questionId,
			userAnswer: input.userAnswer,
			correct: input.correct,
			credit: input.credit,
		});
	}

	const rows = await db
		.select()
		.from(schema.attemptAnswers)
		.where(
			and(
				eq(schema.attemptAnswers.attemptId, input.attemptId),
				eq(schema.attemptAnswers.questionId, input.questionId),
			),
		)
		.limit(1);

	return rows[0];
}

export async function updateAttemptCounters(
	db: AppDatabase,
	attemptId: string,
): Promise<void> {
	const [answerStats] = await db
		.select({
			total: count(schema.attemptAnswers.id),
			correct: count(
				sql`CASE WHEN ${schema.attemptAnswers.correct} = 1 THEN 1 END`,
			),
		})
		.from(schema.attemptAnswers)
		.where(eq(schema.attemptAnswers.attemptId, attemptId));

	await db
		.update(schema.attempts)
		.set({
			answeredQuestions: answerStats?.total ?? 0,
			correctAnswers: answerStats?.correct ?? 0,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.attempts.id, attemptId));
}

export async function completeAttempt(
	db: AppDatabase,
	attemptId: string,
): Promise<AttemptRow> {
	await db
		.update(schema.attempts)
		.set({
			status: "completed",
			completedAt: sql`CURRENT_TIMESTAMP`,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.attempts.id, attemptId));

	const rows = await db
		.select()
		.from(schema.attempts)
		.where(eq(schema.attempts.id, attemptId))
		.limit(1);

	return rows[0];
}

export async function listDistinctTopicsByExamId(
	db: AppDatabase,
	examId: string,
): Promise<ExamTopicOption[]> {
	const rows = await db
		.selectDistinct({
			id: schema.questionTopics.id,
			name: schema.questionTopics.name,
		})
		.from(schema.questions)
		.innerJoin(
			schema.questionTopics,
			eq(schema.questionTopics.id, schema.questions.topicId),
		)
		.where(
			and(
				eq(schema.questions.examId, examId),
				isNotNull(schema.questions.topicId),
			),
		);

	return rows
		.filter(
			(row): row is ExamTopicOption =>
				row.id != null && row.name != null && row.name !== "",
		)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getQuestionsForAttempt(
	db: AppDatabase,
	examId: string,
	input: {
		quantity: number;
		topicFilter: string | null;
		order: "original" | "random";
	},
): Promise<(typeof schema.questions.$inferSelect)[]> {
	const filters = [eq(schema.questions.examId, examId)];
	if (input.topicFilter) {
		filters.push(eq(schema.questions.topicId, input.topicFilter));
	}

	const rows = await db
		.select()
		.from(schema.questions)
		.where(and(...filters))
		.orderBy(schema.questions.createdAt);

	if (input.quantity > 0 && rows.length > input.quantity) {
		return rows.slice(0, input.quantity);
	}

	return rows;
}

export async function getAttemptStats(
	db: AppDatabase,
	userId: string,
): Promise<{
	totalAttempts: number;
	incompleteAttempts: number;
	overallAccuracy: number;
}> {
	const [totalRow] = await db
		.select({ total: count(schema.attempts.id) })
		.from(schema.attempts)
		.where(eq(schema.attempts.userId, userId));

	const [incompleteRow] = await db
		.select({ total: count(schema.attempts.id) })
		.from(schema.attempts)
		.where(
			and(eq(schema.attempts.userId, userId), eq(schema.attempts.status, "in_progress")),
		);

	const [completedRow] = await db
		.select({
			total: count(schema.attempts.id),
			correct: sql<number>`SUM(${schema.attempts.correctAnswers})`,
			totalQuestions: sql<number>`SUM(${schema.attempts.answeredQuestions})`,
		})
		.from(schema.attempts)
		.where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.status, "completed")));

	const totalAttempts = Number(totalRow?.total ?? 0);
	const incompleteAttempts = Number(incompleteRow?.total ?? 0);
	const completedTotal = Number(completedRow?.total ?? 0);
	const correctAnswers = Number(completedRow?.correct ?? 0);
	const answeredQuestions = Number(completedRow?.totalQuestions ?? 0);

	const overallAccuracy =
		completedTotal > 0 && answeredQuestions > 0
			? Math.round((correctAnswers / answeredQuestions) * 100)
			: 0;

	return {
		totalAttempts,
		incompleteAttempts,
		overallAccuracy,
	};
}

export type QuizStats = {
	totalAttempts: number;
	incompleteAttempts: number;
	overallAccuracy: number;
};

export async function listAttemptsByExamId(
	db: AppDatabase,
	userId: string,
	examId: string,
): Promise<AttemptRow[]> {
	return db
		.select()
		.from(schema.attempts)
		.where(
			and(
				eq(schema.attempts.userId, userId),
				eq(schema.attempts.examId, examId),
			),
		)
		.orderBy(sql`${schema.attempts.startedAt} DESC`);
}

export async function getQuizStatsByUserId(
	db: AppDatabase,
	userId: string,
): Promise<QuizStats> {
	const [allAttempts] = await db
		.select({ total: count(schema.attempts.id) })
		.from(schema.attempts)
		.where(eq(schema.attempts.userId, userId));

	const [incomplete] = await db
		.select({ total: count(schema.attempts.id) })
		.from(schema.attempts)
		.where(
			and(
				eq(schema.attempts.userId, userId),
				eq(schema.attempts.status, "in_progress"),
			),
		);

	const [completed] = await db
		.select({
			total: count(schema.attempts.id),
			correct: sql<number>`COALESCE(SUM(${schema.attempts.correctAnswers}), 0)`,
			totalAnswered: sql<number>`COALESCE(SUM(${schema.attempts.answeredQuestions}), 0)`,
		})
		.from(schema.attempts)
		.where(
			and(
				eq(schema.attempts.userId, userId),
				eq(schema.attempts.status, "completed"),
			),
		);

	const completedTotal = completed?.total ?? 0;
	const totalAnswered = completed?.totalAnswered ?? 0;
	const correct = completed?.correct ?? 0;

	const accuracy =
		completedTotal > 0 && totalAnswered > 0
			? Math.round((correct / totalAnswered) * 1000) / 10
			: 0;

	return {
		totalAttempts: allAttempts?.total ?? 0,
		incompleteAttempts: incomplete?.total ?? 0,
		overallAccuracy: accuracy,
	};
}

// Alias kept for backward compatibility with existing quiz server functions.
export { listDistinctTopicsByExamId as listTopicsByExamId };
