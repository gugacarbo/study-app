import { tool, zodSchema, type ToolExecutionOptions, type ToolSet } from "ai";
import { z } from "zod";
import type { Question } from "@/lib/validation";
import {
	type ExtractionQuestionFields,
	type ExtractionQuestionPatch,
	extractionQuestionFieldsSchema,
	extractionQuestionIdSchema,
	extractionQuestionPatchSchema,
} from "./shared";
import type {
	ExtractionQuestionId,
	ExtractionWorkspaceQuestion,
} from "./workspace";
import { ExtractionWorkspaceError } from "./workspace";

interface ExtractionWorkspaceApi {
	addQuestion: (
		input: Partial<Question> & Pick<Question, "question" | "answers">,
	) => ExtractionWorkspaceQuestion;
	updateQuestion: (
		questionId: ExtractionQuestionId,
		patch: Partial<Question>,
	) => ExtractionWorkspaceQuestion;
	listQuestions: () => ExtractionWorkspaceQuestion[];
}

function hasMeaningfulQuestionPatch(input: ExtractionQuestionPatch) {
	return (
		input.question != null ||
		input.options != null ||
		input.answers != null ||
		input.scoringMode != null ||
		input.topic != null ||
		input.explanation != null
	);
}

function toToolFailure(error: unknown) {
	if (error instanceof ExtractionWorkspaceError) {
		return {
			ok: false as const,
			error: {
				code: error.code,
				message: error.message,
			},
		};
	}

	console.error("Ingest extraction tool failed:", error);
	return {
		ok: false as const,
		error: {
			code: "INGEST_TOOL_ERROR",
			message: "Unable to update the current extraction workspace.",
		},
	};
}

export type IngestToolExecutedEvent = {
	toolCallId: string;
	toolName: string;
	input: unknown;
	output: unknown;
};

async function notifyToolExecuted(
	options:
		| {
				onToolExecuted?: (
					event: IngestToolExecutedEvent,
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

const listExtractedQuestionsInputSchema = z.object({});

export function createIngestExtractionTools(
	workspace: ExtractionWorkspaceApi,
	options?: {
		onToolExecuted?: (event: IngestToolExecutedEvent) => void | Promise<void>;
	},
): ToolSet {
	return {
		add_extracted_question: tool({
			description:
				"Add one extracted exam question to the current ingest workspace.",
			inputSchema: zodSchema(extractionQuestionFieldsSchema),
			execute: async (input, context) => {
				const parsedInput = input as ExtractionQuestionFields;
				let output:
					| Awaited<ReturnType<typeof toToolFailure>>
					| {
							ok: true;
							questionId: string;
							totalQuestions: number;
					  };
				try {
					const existingCount = workspace.listQuestions().length;
					const question = workspace.addQuestion(parsedInput);
					output = {
						ok: true as const,
						questionId: question.questionId,
						totalQuestions: workspace.listQuestions().length,
						...(workspace.listQuestions().length === existingCount
							? { alreadyExists: true as const }
							: {}),
					};
				} catch (error) {
					output = toToolFailure(error);
				}
				await notifyToolExecuted(
					options,
					"add_extracted_question",
					parsedInput,
					output,
					context,
				);
				return output;
			},
		}),
		update_extracted_question: tool({
			description:
				"Update a previously added extracted exam question by its workspace questionId. Pass only fields that need correction; omit unchanged fields. A call with only questionId and no field changes is a no-op.",
			inputSchema: zodSchema(extractionQuestionPatchSchema),
			execute: async (input, context) => {
				const parsedInput = input as ExtractionQuestionPatch;
				let output:
					| Awaited<ReturnType<typeof toToolFailure>>
					| {
							ok: true;
							questionId: string;
							updatedFields: Array<
								| "question"
								| "options"
								| "answers"
								| "scoringMode"
								| "topic"
								| "explanation"
							>;
					  };
				try {
					if (!hasMeaningfulQuestionPatch(parsedInput)) {
						output = {
							ok: true as const,
							questionId: parsedInput.questionId,
							updatedFields: [],
						};
					} else {
						workspace.updateQuestion(
							parsedInput.questionId as ExtractionQuestionId,
							{
								question: parsedInput.question ?? undefined,
								options: parsedInput.options ?? undefined,
								answers: parsedInput.answers ?? undefined,
								scoringMode: parsedInput.scoringMode ?? undefined,
								topic: parsedInput.topic ?? undefined,
								explanation: parsedInput.explanation ?? undefined,
							},
						);
						output = {
							ok: true as const,
							questionId: parsedInput.questionId,
							updatedFields: [
								...(parsedInput.question != null ? ["question" as const] : []),
								...(parsedInput.options != null ? ["options" as const] : []),
								...(parsedInput.answers != null ? ["answers" as const] : []),
								...(parsedInput.scoringMode != null
									? ["scoringMode" as const]
									: []),
								...(parsedInput.topic != null ? ["topic" as const] : []),
								...(parsedInput.explanation != null
									? ["explanation" as const]
									: []),
							],
						};
					}
				} catch (error) {
					output = toToolFailure(error);
				}
				await notifyToolExecuted(
					options,
					"update_extracted_question",
					parsedInput,
					output,
					context,
				);
				return output;
			},
		}),
		list_extracted_questions: tool({
			description:
				"List the extracted questions currently stored in the ingest workspace.",
			inputSchema: zodSchema(listExtractedQuestionsInputSchema),
			execute: async (_input, context) => {
				const questions = workspace.listQuestions();
				const output = {
					ok: true as const,
					totalQuestions: questions.length,
					data: questions.map((question) => ({
						questionId: question.questionId,
						question: question.question,
						options: [...question.options],
						answers: [...question.answers],
						scoringMode: question.scoringMode,
						topic: question.topic ?? "General",
					})),
				};
				await notifyToolExecuted(
					options,
					"list_extracted_questions",
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
	extractionQuestionFieldsSchema,
	extractionQuestionIdSchema,
	extractionQuestionPatchSchema,
	listExtractedQuestionsInputSchema,
};
