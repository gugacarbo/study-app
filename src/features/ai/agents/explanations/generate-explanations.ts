import { z } from "zod";
import { generateJson } from "@/features/ai/core/generate";
import type { ProviderConfig } from "@/lib/validation";
import { buildSystemPrompt } from "./system-prompt";

export const explanationBatchSchema = z.object({
	questions: z.array(
		z.object({
			id: z.number().int().positive(),
			explanation: z.string().min(1),
			deepExplanation: z.string().min(1),
		}),
	),
});

export type ExplanationBatchResult = z.infer<typeof explanationBatchSchema>;

export interface ExplanationBatchInput {
	id: number;
	question: string;
	options: string[];
	answer: string;
	topic?: string;
	explanation?: string;
}

type ExplanationAgentRunStatus = "pending" | "running" | "done" | "error";

export interface ExplanationAgentRunEvent {
	eventType: "lifecycle" | "result";
	stageId: "explanations";
	agentRunId: string;
	label: string;
	status?: ExplanationAgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: ExplanationBatchResult;
	error?: string;
	meta?: {
		questionCount: number;
		questionIds: number[];
	};
}

export interface ExplanationAgentRunSummary {
	agentRunId: string;
	label: string;
	status: ExplanationAgentRunStatus;
	systemPrompt: string;
	userPrompt: string;
	rawText?: string;
	finalObject?: ExplanationBatchResult;
	error?: string;
	meta?: {
		questionCount: number;
		questionIds: number[];
	};
}

interface RunBatchQuestionExplanationsOptions {
	memoryContext?: string;
	tools?: NonNullable<Parameters<typeof generateJson>[3]>["tools"];
	onAgentEvent?: (event: ExplanationAgentRunEvent) => void;
	createAgentRunId?: (label: string) => string;
}

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
	const userPrompt = `Generate explanation and deepExplanation for each question below.

Questions input:
${JSON.stringify(questions, null, 2)}`;

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
				tools: options.tools,
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
