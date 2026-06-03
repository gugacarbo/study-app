import { and, count, eq, sql } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import type { AttemptStatsSummary, TopicStats } from "./types";

export function getExamStats(
	this: DBQueries,
	examId: number,
): Promise<{
	totalQuestions: number;
	totalAttempts: number;
	completedAttempts: number;
	incompleteAttempts: number;
	correctAnswers: number;
	answeredQuestions: number;
	overallAccuracy: number;
	topicStats: TopicStats[];
}> {
	const overallPromise = this.db
		.select({
			totalAttempts: count(schema.attempts.id),
			completedAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
			incompleteAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} != 'completed' THEN 1 ELSE 0 END), 0)`,
		})
		.from(schema.attempts)
		.where(eq(schema.attempts.exam_id, examId))
		.get();

	const answerTotalsPromise = this.db
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

	const totalQuestionsPromise = this.db
		.select({ count: count() })
		.from(schema.questions)
		.where(eq(schema.questions.exam_id, examId))
		.get();

	const topicResultsPromise = this.db
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

	return Promise.all([
		overallPromise,
		answerTotalsPromise,
		totalQuestionsPromise,
		topicResultsPromise,
	]).then(([overall, answerTotals, totalQuestionsResult, topicResults]) => {
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
	});
}

export function getStats(
	this: DBQueries,
): Promise<AttemptStatsSummary & { topics: TopicStats[] }> {
	const totalsPromise = this.db
		.select({
			totalAttempts: count(schema.attempts.id),
			completedAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
			incompleteAttempts: sql<number>`COALESCE(SUM(CASE WHEN ${schema.attempts.status} != 'completed' THEN 1 ELSE 0 END), 0)`,
		})
		.from(schema.attempts)
		.get();

	const answerTotalsPromise = this.db
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

	const topicsResultPromise = this.db
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

	return Promise.all([
		totalsPromise,
		answerTotalsPromise,
		topicsResultPromise,
	]).then(([totals, answerTotals, topicsResult]) => {
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
	});
}
