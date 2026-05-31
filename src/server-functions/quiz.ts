import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "../db/queries";
import { generateQuizQuestions } from "@/features/ai/agents/quiz";
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
	questionId: z.number(),
	userAnswer: z.string(),
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

		await queries.recordAttempt(data.questionId, data.userAnswer, correct);

		return {
			correct,
			explanation: shortExplanation,
			longExplanation,
		};
	});
