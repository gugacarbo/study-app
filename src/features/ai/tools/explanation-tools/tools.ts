import { tool, zodSchema, type ToolExecutionOptions, type ToolSet } from "ai";
import { z } from "zod";
import {
	explanationPatchSchema,
	explanationQuestionIdSchema,
} from "./shared";
import type { ExplanationWorkspaceQuestion } from "./workspace";
import { ExplanationWorkspaceError } from "./workspace";

interface ExplanationWorkspaceApi {
	updateQuestionExplanation: (
		questionId: number,
		patch: { explanation?: string; deepExplanation?: string },
	) => ExplanationWorkspaceQuestion;
	listQuestions: () => ExplanationWorkspaceQuestion[];
}

const listExplanationQuestionsInputSchema = z.object({});

function toToolFailure(error: unknown) {
	if (error instanceof ExplanationWorkspaceError) {
		return {
			ok: false as const,
			error: {
				code: error.code,
				message: error.message,
			},
		};
	}

	console.error("Explanation tool failed:", error);
	return {
		ok: false as const,
		error: {
			code: "EXPLANATION_TOOL_ERROR",
			message: "Unable to update the current explanation workspace.",
		},
	};
}

export type ExplanationToolExecutedEvent = {
	toolCallId: string;
	toolName: string;
	input: unknown;
	output: unknown;
};

async function notifyToolExecuted(
	options:
		| {
				onToolExecuted?: (
					event: ExplanationToolExecutedEvent,
				) => void | Promise<void>;
		  }
		| undefined,
	toolName: string,
	input: unknown,
	output: unknown,
	context?: ToolExecutionOptions,
) {
	const toolCallId = context?.toolCallId;
	if (!toolCallId) return;
	await options?.onToolExecuted?.({
		toolCallId,
		toolName,
		input,
		output,
	});
}

export function createExplanationTools(
	workspace: ExplanationWorkspaceApi,
	options?: {
		onToolExecuted?: (
			event: ExplanationToolExecutedEvent,
		) => void | Promise<void>;
	},
): ToolSet {
	return {
		update_question_explanation: tool({
			description:
				"Write explanation and deepExplanation for one question. questionId, explanation, and deepExplanation are all required.",
			inputSchema: zodSchema(explanationPatchSchema),
			execute: async (input, context) => {
				let output:
					| Awaited<ReturnType<typeof toToolFailure>>
					| {
							ok: true;
							questionId: number;
							updatedFields: readonly ["explanation", "deepExplanation"];
					  };
				try {
					workspace.updateQuestionExplanation(input.questionId, {
						explanation: input.explanation,
						deepExplanation: input.deepExplanation,
					});

					output = {
						ok: true as const,
						questionId: input.questionId,
						updatedFields: ["explanation", "deepExplanation"] as const,
					};
				} catch (error) {
					output = toToolFailure(error);
				}
				await notifyToolExecuted(
					options,
					"update_question_explanation",
					input,
					output,
					context,
				);
				return output;
			},
		}),
		list_explanation_questions: tool({
			description:
				"List the questions currently stored in the explanation workspace.",
			inputSchema: zodSchema(listExplanationQuestionsInputSchema),
			execute: async (_input, context) => {
				const output = {
					ok: true as const,
					data: workspace.listQuestions().map((question) => ({
						id: question.id,
						question: question.question,
						options: [...question.options],
						answers: [...question.answers],
						scoringMode: question.scoringMode ?? "exact",
						topic: question.topic ?? "General",
						explanation: question.explanation ?? "",
						hasExplanation: Boolean(question.explanation?.trim()),
						hasDeepExplanation: Boolean(question.deepExplanation?.trim()),
					})),
				};
				await notifyToolExecuted(
					options,
					"list_explanation_questions",
					{},
					output,
					context,
				);
				return output;
			},
		}),
	};
}

export {
	explanationPatchSchema,
	explanationQuestionIdSchema,
	listExplanationQuestionsInputSchema,
};
