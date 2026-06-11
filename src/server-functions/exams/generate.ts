import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	type ExplanationAgentRunSummary,
	runQuestionExplanations,
} from "@/features/ai/agents/explanations";
import { DBQueries } from "../../db/queries";
import { requireModelConfig } from "../../lib/ai-config";
import { MemoryManager } from "../../lib/memory";
import { buildTopicMemoryResolver } from "../../lib/memory/topic-context";
import { getDB } from "../db";

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

		const providerConfig = await requireModelConfig(queries, "explanations");

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

		const memory = new MemoryManager(db);
		await memory.ensureStructure();
		const topicMemory = await buildTopicMemoryResolver(
			memory,
			targets.map((question) => question.topic ?? "General"),
		);

		const explanationResult = await runQuestionExplanations(
			providerConfig,
			targets.map((question) => ({
				id: question.id,
				question: question.question,
				options: question.options,
				answers: question.answers,
				scoringMode: question.scoringMode,
				topic: question.topic,
				explanation: question.explanation,
			})),
			{
				resolveMemoryContext: (question) =>
					topicMemory.resolveMemoryContext(question.topic),
				concurrency: ctx.data.batchSize,
				createAgentRunId: (label) =>
					`exam-explanations:${label.toLowerCase().replaceAll(" ", "-")}`,
			},
		);

		const generatedById = new Map(
			explanationResult.questions.map((item) => [item.id, item]),
		);
		const updatedQuestionIds: number[] = [];
		const generatedResponses: Array<{
			id: number;
			explanation: string;
			deepExplanation: string;
		}> = [];
		const agentRuns: ExplanationAgentRunSummary[] = explanationResult.agentRuns;

		for (const question of targets) {
			const generatedItem = generatedById.get(question.id);
			if (!generatedItem) {
				continue;
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
		}

		return {
			success: true,
			updated: updatedQuestionIds.length,
			totalQuestions: exam.questions.length,
			processedQuestions: targets.length,
			batches: targets.length,
			updatedQuestionIds,
			generatedResponses,
			agentRuns,
		};
	});
