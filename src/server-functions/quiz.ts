import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateQuizQuestions } from "@/features/ai/agents/quiz";
import { DBQueries } from "../db/queries";
import { providerConfigSchema } from "../lib/validation";
import { getDB } from "./db";
import { getMemoryContext } from "./memory";

const generateQuizSchema = z.object({
	topic: z.string().optional(),
	count: z.number().optional(),
	config: providerConfigSchema,
	examId: z.number().optional(),
});

const submitAnswerSchema = z.object({
	attemptId: z.number().optional(),
	examId: z.number().optional(),
	topic: z.string().optional(),
	totalQuestions: z.number().int().positive(),
	questionId: z.number(),
	userAnswer: z.string(),
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

		const memoryResult = await getMemoryContext({
			data: { topics: [topic] },
		}).catch(() => ({ context: "" }));
		return await generateQuizQuestions(
			data.config,
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

		const normalizeAnswer = (value: string) => value.trim().toLowerCase();
		const normalizedUserAnswer = normalizeAnswer(data.userAnswer);
		const normalizedCorrectAnswer = normalizeAnswer(storedQuestion.answer);
		const correct = normalizedUserAnswer === normalizedCorrectAnswer;
		const shortExplanation =
			storedQuestion.explanation ||
			(correct
				? "Resposta correta."
				: `Resposta incorreta. A resposta correta é: ${storedQuestion.answer}`);
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
			userAnswer: data.userAnswer,
			correct,
		});
		await queries.refreshAttemptProgress(attemptId);
		const attempt = await queries.getAttemptById(attemptId);
		if (!attempt) {
			throw new Error("Attempt not found after saving answer");
		}

		return {
			attemptId,
			attemptStatus: attempt.status,
			correct,
			explanation: shortExplanation,
			longExplanation,
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
