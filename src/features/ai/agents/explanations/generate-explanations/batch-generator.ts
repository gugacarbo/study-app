import { generateJson } from "@/features/ai/core/generate";
import type { ProviderConfig } from "@/lib/validation";
import { buildSystemPrompt } from "../system-prompt";
import { buildUserPrompt } from "./prompt";
import {
	type ExplanationAgentRunSummary,
	type ExplanationBatchInput,
	type ExplanationBatchResult,
	explanationBatchSchema,
	type RunBatchQuestionExplanationsOptions,
} from "./types";

export async function runBatchQuestionExplanations(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	options: RunBatchQuestionExplanationsOptions = {},
): Promise<{
	questions: ExplanationBatchResult["questions"];
	agentRuns: ExplanationAgentRunSummary[];
}> {
	const label = "Explanation batch 1";
	const agentRunId =
		options.createAgentRunId?.(label) ?? "explanations-batch-1";
	const systemPrompt = buildSystemPrompt(options.memoryContext);
	const userPrompt = buildUserPrompt(questions);

	const agentRuns: ExplanationAgentRunSummary[] = [
		{
			agentRunId,
			label,
			status: "pending",
			systemPrompt,
			userPrompt,
			meta: {
				questionCount: questions.length,
				questionIds: questions.map((question) => question.id),
			},
		},
	];

	options.onAgentEvent?.({
		eventType: "lifecycle",
		stageId: "explanations",
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: agentRuns[0].meta,
	});
	options.onAgentEvent?.({
		eventType: "lifecycle",
		stageId: "explanations",
		agentRunId,
		label,
		status: "running",
		meta: agentRuns[0].meta,
	});
	agentRuns[0].status = "running";

	try {
		const result = await generateJson<ExplanationBatchResult>(
			config,
			userPrompt,
			explanationBatchSchema,
			{
				system: systemPrompt,
				tools: options.tools as NonNullable<
					Parameters<typeof generateJson>[3]
				>["tools"],
			},
		);

		agentRuns[0] = {
			...agentRuns[0],
			status: "done",
			rawText: JSON.stringify(result),
			finalObject: result,
		};

		options.onAgentEvent?.({
			eventType: "result",
			stageId: "explanations",
			agentRunId,
			label,
			rawText: JSON.stringify(result),
			finalObject: result,
			meta: agentRuns[0].meta,
		});
		options.onAgentEvent?.({
			eventType: "lifecycle",
			stageId: "explanations",
			agentRunId,
			label,
			status: "done",
			meta: agentRuns[0].meta,
		});

		return {
			questions: result.questions,
			agentRuns,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		agentRuns[0] = {
			...agentRuns[0],
			status: "error",
			error: message,
		};

		options.onAgentEvent?.({
			eventType: "lifecycle",
			stageId: "explanations",
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: agentRuns[0].meta,
		});

		throw error;
	}
}

export async function generateQuestionExplanationsBatch(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	memoryContext?: string,
): Promise<ExplanationBatchResult["questions"]> {
	const result = await runBatchQuestionExplanations(config, questions, {
		memoryContext,
	});
	return result.questions;
}
