import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateQuizQuestions } from "@/features/ai/agents/quiz";
import { scoreAnswer } from "@/lib/answer-scoring";
import { DBQueries } from "../db/queries";
import { requireProviderConfigFromDb } from "../lib/ai-config";
import { getDB } from "./db";
import { getMemoryContext } from "./memory";

const generateQuizSchema = z.object({
	topic: z.string().optional(),
	count: z.number().optional(),
	examId: z.number().optional(),
});

const submitAnswerSchema = z.object({
	attemptId: z.number().optional(),
	examId: z.number().optional(),
	topic: z.string().optional(),
	totalQuestions: z.number().int().positive(),
	questionId: z.number(),
	userAnswers: z.array(z.string()),
});

const listQuizAttemptsSchema = z.object({
	examId: z.number().optional(),
	topic: z.string().optional(),
	pageSize: z.number().int().positive().max(20).optional(),
});

const abandonQuizAttemptsSchema = z.object({
	examId: z.number().optional(),
	topic: z.string().optional(),
});

function formatCorrectAnswers(answers: string[]): string {
	return answers.length === 1 ? answers[0] : answers.join("; ");
}

export const generateQuiz = createServerFn({ method: "POST" })
	.inputValidator(generateQuizSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);

		if (data.examId) {
			return await queries.getQuestionsByExam(data.examId);
		}

		const count = data.count || 10;

		if (data.topic) {
			const existing = await queries.getRandomQuestions(count, data.topic);
			if (existing.length > 0) return existing;
		}

		const topic = data.topic || "General";
		const providerConfig = await requireProviderConfigFromDb(queries);

		const memoryResult = await getMemoryContext({
			data: { topics: [topic] },
		}).catch(() => ({ context: "" }));
		return await generateQuizQuestions(
			providerConfig,
			topic,
			count,
			memoryResult.context || undefined,
		);
	});

export const submitAnswer = createServerFn({ method: "POST" })
	.inputValidator(submitAnswerSchema)
	.handler(async (ctx) => {
		const { data } = ctx;

		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		const storedQuestion = await queries.getQuestionById(data.questionId);
		if (!storedQuestion) {
			throw new Error("Question not found");
		}

		const { credit, isFullyCorrect } = scoreAnswer(
			data.userAnswers,
			storedQuestion.answers,
			storedQuestion.scoringMode,
		);
		const correctAnswersText = formatCorrectAnswers(storedQuestion.answers);
		const shortExplanation =
			storedQuestion.explanation ||
			(isFullyCorrect
				? "Resposta correta."
				: storedQuestion.answers.length > 1
					? `Resposta incorreta. As respostas corretas são: ${correctAnswersText}`
					: `Resposta incorreta. A resposta correta é: ${correctAnswersText}`);
		const longExplanation = storedQuestion.deepExplanation || "";

		let attemptId = data.attemptId;
		if (!attemptId) {
			await queries.abandonInProgressAttempts({
				examId: data.examId,
				topic: data.topic,
			});
			attemptId = await queries.createAttemptSession({
				examId: data.examId,
				topic: data.topic,
				totalQuestions: data.totalQuestions,
			});
		}

		await queries.upsertAttemptAnswer({
			attemptId,
			questionId: data.questionId,
			userAnswers: data.userAnswers,
			correct: isFullyCorrect,
			credit,
		});
		await queries.refreshAttemptProgress(attemptId);
		const attempt = await queries.getAttemptById(attemptId);
		if (!attempt) {
			throw new Error("Attempt not found after saving answer");
		}

		return {
			attemptId,
			attemptStatus: attempt.status,
			credit,
			correct: isFullyCorrect,
			explanation: shortExplanation,
			longExplanation,
			correctAnswers: storedQuestion.answers,
		};
	});

export const listQuizAttempts = createServerFn({ method: "POST" })
	.inputValidator(listQuizAttemptsSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		if (data.examId === undefined && data.topic === undefined) return [];

		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		const result = await queries.listAttemptsPaged({
			examId: data.examId,
			topic: data.topic,
			page: 1,
			pageSize: data.pageSize ?? 5,
		});

		return result.items;
	});

export const abandonQuizAttempts = createServerFn({ method: "POST" })
	.inputValidator(abandonQuizAttemptsSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		if (data.examId === undefined && data.topic === undefined) return;

		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.abandonInProgressAttempts({
			examId: data.examId,
			topic: data.topic,
		});
	});
