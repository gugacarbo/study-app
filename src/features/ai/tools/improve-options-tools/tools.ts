import {
	GET_QUESTION_TOOL,
	UPDATE_QUESTION_OPTIONS_TOOL,
} from "@/features/ai/agents/improve-options/contracts";
import { type ToolExecutionContext, toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
	type GetQuestionInput,
	type UpdateQuestionOptionsPatch,
	getQuestionInputSchema,
	improveOptionsToolFailureSchema,
	updateQuestionOptionsPatchSchema,
} from "./shared";
import type { ImproveOptionsUpdatedField } from "./workspace";
import { ImproveOptionsWorkspaceError } from "./workspace";

interface ImproveOptionsWorkspaceApi {
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
	getUpdatedFields: (id: number) => ImproveOptionsUpdatedField[];
}

const getQuestionSuccessSchema = z.object({
	ok: z.literal(true),
	data: z.object({
		id: z.number().int().positive(),
		question: z.string(),
		options: z.array(z.string()),
		answers: z.array(z.string()),
		scoringMode: z.enum(["exact", "partial"]),
		explanation: z.string(),
	}),
});

const updateQuestionOptionsSuccessSchema = z.object({
	ok: z.literal(true),
	id: z.number().int().positive(),
	updatedFields: z.array(z.enum(["options", "answer", "explanation"])),
});

const getQuestionDef = toolDefinition({
	name: GET_QUESTION_TOOL,
	description:
		"Read the current improve-options workspace question snapshot by database id.",
	inputSchema: getQuestionInputSchema,
	outputSchema: z.union([
		getQuestionSuccessSchema,
		improveOptionsToolFailureSchema,
	]),
});

const updateQuestionOptionsDef = toolDefinition({
	name: UPDATE_QUESTION_OPTIONS_TOOL,
	description:
		"Update options, answers, and/or explanation for a question in the improve-options workspace. Options must keep at least 5 entries and every answer must match one option.",
	inputSchema: updateQuestionOptionsPatchSchema,
	outputSchema: z.union([
		updateQuestionOptionsSuccessSchema,
		improveOptionsToolFailureSchema,
	]),
});

function hasMeaningfulOptionsPatch(input: UpdateQuestionOptionsPatch) {
	return (
		input.options != null ||
		input.answers != null ||
		input.scoringMode != null ||
		input.explanation != null
	);
}

function toToolFailure(error: unknown) {
	if (error instanceof ImproveOptionsWorkspaceError) {
		return {
			ok: false as const,
			error: {
				code: error.code,
				message: error.message,
			},
		};
	}

	console.error("Improve options tool failed:", error);
	return {
		ok: false as const,
		error: {
			code: "IMPROVE_OPTIONS_TOOL_ERROR",
			message: "Unable to update the improve-options workspace.",
		},
	};
}

export type ImproveOptionsToolExecutedEvent = {
	toolCallId: string;
	toolName: string;
	input: unknown;
	output: unknown;
};

async function notifyToolExecuted(
	options:
		| {
				onToolExecuted?: (
					event: ImproveOptionsToolExecutedEvent,
				) => void | Promise<void>;
		  }
		| undefined,
	toolName: string,
	input: unknown,
	output: unknown,
	context?: ToolExecutionContext,
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

export function createImproveOptionsTools(
	workspace: ImproveOptionsWorkspaceApi,
	options?: {
		onToolExecuted?: (
			event: ImproveOptionsToolExecutedEvent,
		) => void | Promise<void>;
	},
) {
	const getQuestion = getQuestionDef.server(
		async (input: GetQuestionInput, context) => {
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
	);

	const updateQuestionOptions = updateQuestionOptionsDef.server(
		async (input, context) => {
			const parsedInput = input as UpdateQuestionOptionsPatch;
			let output:
				| Awaited<ReturnType<typeof toToolFailure>>
				| {
						ok: true;
						id: number;
						updatedFields: ImproveOptionsUpdatedField[];
				  };
			try {
				if (!hasMeaningfulOptionsPatch(parsedInput)) {
					output = {
						ok: true as const,
						id: parsedInput.id,
						updatedFields: [],
					};
				} else {
					workspace.updateQuestion(parsedInput.id, {
						options: parsedInput.options ?? undefined,
						answers: parsedInput.answers ?? undefined,
						scoringMode: parsedInput.scoringMode ?? undefined,
						explanation: parsedInput.explanation ?? undefined,
					});
					output = {
						ok: true as const,
						id: parsedInput.id,
						updatedFields: workspace.getUpdatedFields(parsedInput.id),
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
	);

	return [getQuestion, updateQuestionOptions] as const;
}
