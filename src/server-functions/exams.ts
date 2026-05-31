import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "../db/queries";
import { env } from "../env";
import { generateQuestionExplanationsBatch } from "@/features/ai/agents/explanations";
import type { ProviderConfig } from "../lib/validation";
import { getDB } from "./db";
import { getMemoryContext } from "./memory";

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let idx = 0; idx < items.length; idx += chunkSize) {
		chunks.push(items.slice(idx, idx + chunkSize));
	}
	return chunks;
}

export const getExamDetail = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			id: z.coerce.number().int().positive(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		const exam = await queries.getExamFull(ctx.data.id);
		if (!exam) throw new Error("Exam not found");
		return exam;
	});

export const getExamsDetailed = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		return await queries.getExamsDetailed();
	},
);

export const deleteExam = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.number(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.deleteExam(ctx.data.id);
		return { success: true };
	});

export const updateQuestion = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.number(),
			question: z.string().min(1).optional(),
			options: z.array(z.string()).min(2).optional(),
			answer: z.string().min(1).optional(),
			explanation: z.string().optional(),
			deepExplanation: z.string().optional(),
			topic: z.string().optional(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.updateQuestion(ctx.data.id, ctx.data);
		return { success: true };
	});

export const deleteQuestion = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.number(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.deleteQuestion(ctx.data.id);
		return { success: true };
	});

export const generateExamQuestionExplanations = createServerFn({
	method: "POST",
})
	.inputValidator(
		z.object({
			examId: z.number().int().positive(),
			overwrite: z.boolean().default(false),
			batchSize: z.number().int().min(1).max(20).default(10),
			questionIds: z.array(z.number().int().positive()).optional(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		const exam = await queries.getExamFull(ctx.data.examId);
		if (!exam) throw new Error("Exam not found");

		const config = await queries.getAllConfig();
		const apiKey = config.ai_api_key || env.OPENROUTER_API_KEY;
		if (!apiKey) {
			throw new Error(
				"AI API key not configured. Please configure it in /config first.",
			);
		}

		const providerConfig: ProviderConfig = {
			provider: (config.ai_provider ||
				env.AI_PROVIDER) as ProviderConfig["provider"],
			model: config.ai_model || env.AI_MODEL,
			baseUrl: config.ai_base_url || undefined,
			apiKey,
		};

		const requestedIds = ctx.data.questionIds
			? new Set(ctx.data.questionIds)
			: null;

		const targets = exam.questions.filter((question) => {
			if (requestedIds && !requestedIds.has(question.id)) return false;
			if (ctx.data.overwrite) return true;
			const hasExplanation = Boolean(question.explanation?.trim());
			const hasDeepExplanation = Boolean(question.deepExplanation?.trim());
			return !hasExplanation || !hasDeepExplanation;
		});

		if (targets.length === 0) {
			return {
				success: true,
				updated: 0,
				totalQuestions: exam.questions.length,
				processedQuestions: 0,
				batches: 0,
			};
		}

		const memoryResult = await getMemoryContext({
			data: {
				topics: exam.topics.length > 0 ? exam.topics : ["General"],
			},
		}).catch(() => ({ context: "" }));

		const questionChunks = chunkArray(targets, ctx.data.batchSize);
		let updated = 0;
		const updatedQuestionIds: number[] = [];
		const generatedResponses: Array<{
			id: number;
			explanation: string;
			deepExplanation: string;
		}> = [];

		for (const chunk of questionChunks) {
			const generated = await generateQuestionExplanationsBatch(
				providerConfig,
				chunk.map((question) => ({
					id: question.id,
					question: question.question,
					options: question.options,
					answer: question.answer,
					topic: question.topic,
					explanation: question.explanation,
				})),
				memoryResult.context || undefined,
			);

			const generatedById = new Map(generated.map((item) => [item.id, item]));

			for (const question of chunk) {
				const generatedItem = generatedById.get(question.id);
				if (!generatedItem) {
					throw new Error(`Missing explanation for question id ${question.id}`);
				}

				await queries.updateQuestion(question.id, {
					explanation: generatedItem.explanation.trim(),
					deepExplanation: generatedItem.deepExplanation.trim(),
				});
				updatedQuestionIds.push(question.id);
				generatedResponses.push({
					id: question.id,
					explanation: generatedItem.explanation.trim(),
					deepExplanation: generatedItem.deepExplanation.trim(),
				});
				updated += 1;
			}
		}

		return {
			success: true,
			updated,
			totalQuestions: exam.questions.length,
			processedQuestions: targets.length,
			batches: questionChunks.length,
			updatedQuestionIds,
			generatedResponses,
		};
	});
