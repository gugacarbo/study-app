import { type ToolExecutionOptions, type ToolSet, tool, zodSchema } from "ai";
import {
	GET_QUESTION_TOOL,
	UPDATE_QUESTION_OPTIONS_TOOL,
} from "@/features/ai/agents/improve-questions/contracts";
import {
	type GetQuestionInput,
	getQuestionInputSchema,
	type UpdateQuestionOptionsPatch,
	updateQuestionOptionsPatchSchema,
} from "./shared";
import type { ImproveQuestionsUpdatedField } from "./workspace";
import { ImproveQuestionsWorkspaceError } from "./workspace";

interface ImproveQuestionsWorkspaceApi {
	getQuestion: (id: number) => {
		id: number;
		question: string;
		options: string[];
		answers: string[];
		scoringMode: "exact" | "partial";
		explanation: string;
	};
	updateQuestion: (
		id: number,
		patch: Partial<{
			question: string;
			options: string[];
			answers: string[];
			scoringMode: "exact" | "partial";
			explanation: string;
		}>,
	) => {
		id: number;
		question: string;
		options: string[];
		answers: string[];
		scoringMode: "exact" | "partial";
		explanation: string;
	};
	getUpdatedFields: (id: number) => ImproveQuestionsUpdatedField[];
}

function hasMeaningfulOptionsPatch(input: UpdateQuestionOptionsPatch) {
	return (
		input.question != null ||
		input.options != null ||
		input.answers != null ||
		input.scoringMode != null ||
		input.explanation != null
	);
}

function toToolFailure(error: unknown) {
	if (error instanceof ImproveQuestionsWorkspaceError) {
		return {
			ok: false as const,
			error: {
				code: error.code,
				message: error.message,
			},
		};
	}

	console.error("Improve question tool failed:", error);
	return {
		ok: false as const,
		error: {
			code: "IMPROVE_QUESTIONS_TOOL_ERROR",
			message: "Unable to update the improve-questions workspace.",
		},
	};
}

export type ImproveQuestionsToolExecutedEvent = {
	toolCallId: string;
	toolName: string;
	input: unknown;
	output: unknown;
};

async function notifyToolExecuted(
	options:
		| {
				onToolExecuted?: (
					event: ImproveQuestionsToolExecutedEvent,
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

export function createImproveQuestionsTools(
	workspace: ImproveQuestionsWorkspaceApi,
	options?: {
		onToolExecuted?: (
			event: ImproveQuestionsToolExecutedEvent,
		) => void | Promise<void>;
	},
): ToolSet {
	return {
		[GET_QUESTION_TOOL]: tool({
			description:
				"Read the current improve-questions workspace question snapshot by numeric question id.",
			inputSchema: zodSchema(getQuestionInputSchema),
			execute: async (input: GetQuestionInput, context) => {
				let output:
					| Awaited<ReturnType<typeof toToolFailure>>
					| {
							ok: true;
							data: {
								id: number;
								question: string;
								options: string[];
								answers: string[];
								scoringMode: "exact" | "partial";
								explanation: string;
							};
					  };
				try {
					const question = workspace.getQuestion(input.id);
					output = {
						ok: true as const,
						data: {
							id: question.id,
							question: question.question,
							options: [...question.options],
							answers: [...question.answers],
							scoringMode: question.scoringMode,
							explanation: question.explanation,
						},
					};
				} catch (error) {
					output = toToolFailure(error);
				}
				await notifyToolExecuted(
					options,
					GET_QUESTION_TOOL,
					input,
					output,
					context,
				);
				return output;
			},
		}),
		[UPDATE_QUESTION_OPTIONS_TOOL]: tool({
			description:
				"Update the question stem, options, answers, scoring mode, and/or explanation in the improve-questions workspace. Options must keep at least 5 entries and every answer must match one option.",
			inputSchema: zodSchema(updateQuestionOptionsPatchSchema),
			execute: async (input, context) => {
				const parsedInput = input as UpdateQuestionOptionsPatch;
				let output:
					| Awaited<ReturnType<typeof toToolFailure>>
					| {
							ok: true;
							id: number;
							updatedFields: ImproveQuestionsUpdatedField[];
							message: string;
					  };
				try {
					if (!hasMeaningfulOptionsPatch(parsedInput)) {
						output = {
							ok: true as const,
							id: parsedInput.id,
							updatedFields: [],
							message:
								"No fields changed. Stop calling update_question_options and finish with a brief summary.",
						};
					} else {
						workspace.updateQuestion(parsedInput.id, {
							question: parsedInput.question ?? undefined,
							options: parsedInput.options ?? undefined,
							answers: parsedInput.answers ?? undefined,
							scoringMode: parsedInput.scoringMode ?? undefined,
							explanation: parsedInput.explanation ?? undefined,
						});
						output = {
							ok: true as const,
							id: parsedInput.id,
							updatedFields: workspace.getUpdatedFields(parsedInput.id),
							message:
								"Question updated. Stop calling update_question_options and finish with a brief summary.",
						};
					}
				} catch (error) {
					output = toToolFailure(error);
				}
				await notifyToolExecuted(
					options,
					UPDATE_QUESTION_OPTIONS_TOOL,
					parsedInput,
					output,
					context,
				);
				return output;
			},
		}),
	};
}
