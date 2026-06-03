import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	type ExplanationAgentRunSummary,
	runBatchQuestionExplanations,
} from "@/features/ai/agents/explanations";
import { DBQueries } from "../../db/queries";
import { env } from "../../env";
import type { ProviderConfig } from "../../lib/validation";
import { getDB } from "../db";
import { getMemoryContext } from "../memory";
import { chunkArray } from "./types";

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
				updatedQuestionIds: [],
				generatedResponses: [],
				agentRuns: [],
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
		const agentRuns: ExplanationAgentRunSummary[] = [];

		for (const [batchIndex, chunk] of questionChunks.entries()) {
			const batchResult = await runBatchQuestionExplanations(
				providerConfig,
				chunk.map((question) => ({
					id: question.id,
					question: question.question,
					options: question.options,
					answer: question.answer,
					topic: question.topic,
					explanation: question.explanation,
				})),
				{
					memoryContext: memoryResult.context || undefined,
					createAgentRunId: (label) =>
						`explanations-batch-${batchIndex + 1}:${label.toLowerCase().replaceAll(" ", "-")}`,
				},
			);
			agentRuns.push(...batchResult.agentRuns);

			const generatedById = new Map(
				batchResult.questions.map((item) => [item.id, item]),
			);

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
			agentRuns,
		};
	});
