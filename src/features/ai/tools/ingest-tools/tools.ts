import { type ToolExecutionOptions, type ToolSet, tool, zodSchema } from "ai";
import { z } from "zod";
import {
	createReportAgentStageStatusTool,
	type IngestStageStatusToolEvent,
} from "@/features/ai/tools/ingest-stage-status";
import type { Question } from "@/lib/validation";
import {
	type ExtractionQuestionFields,
	type ExtractionQuestionPatch,
	extractionQuestionFieldsSchema,
	extractionQuestionPatchSchema,
	INGEST_TOOL_ERROR_CODE,
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

type ExtractionUpdatedField =
	| "question"
	| "options"
	| "answers"
	| "scoringMode"
	| "topic"
	| "explanation";

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

function collectUpdatedFields(
	parsedInput: ExtractionQuestionPatch,
): ExtractionUpdatedField[] {
	return [
		...(parsedInput.question != null ? ["question" as const] : []),
		...(parsedInput.options != null ? ["options" as const] : []),
		...(parsedInput.answers != null ? ["answers" as const] : []),
		...(parsedInput.scoringMode != null ? ["scoringMode" as const] : []),
		...(parsedInput.topic != null ? ["topic" as const] : []),
		...(parsedInput.explanation != null ? ["explanation" as const] : []),
	];
}

function buildUpdateSuccessMessage(
	questionId: string,
	updatedFields: ExtractionUpdatedField[],
) {
	if (updatedFields.length === 0) {
		return `No changes applied to ${questionId}. The question is already correct — stop calling update_extracted_question.`;
	}

	return `Updated ${questionId}: ${updatedFields.join(", ")}. Stop if no further corrections are needed.`;
}

function buildListSuccessMessage(totalQuestions: number) {
	if (totalQuestions === 0) {
		return "No questions registered in the extraction workspace yet.";
	}

	return `Listed ${totalQuestions} question(s) from the extraction workspace.`;
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
	const message =
		error instanceof Error && error.message.length > 0
			? error.message
			: "Unable to update the current extraction workspace.";
	return {
		ok: false as const,
		error: {
			code: INGEST_TOOL_ERROR_CODE,
			message,
		},
	};
}

type IngestToolExecutedEvent = {
	toolCallId: string;
	toolName: string;
	input: unknown;
	output: unknown;
};

export type IngestExtractionToolsOptions = {
	onToolExecuted?: (event: IngestToolExecutedEvent) => void | Promise<void>;
	onStageStatusReported?: (
		event: IngestStageStatusToolEvent,
	) => void | Promise<void>;
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

const REVIEW_OMITTED_TOOLS = [
	"add_extracted_question",
	"list_extracted_questions",
] as const;

export function createIngestReviewTools(
	workspace: ExtractionWorkspaceApi,
	options?: IngestExtractionToolsOptions,
): ToolSet {
	const tools = createIngestExtractionTools(workspace, options);
	return Object.fromEntries(
		Object.entries(tools).filter(
			([name]) => !(REVIEW_OMITTED_TOOLS as readonly string[]).includes(name),
		),
	);
}

export function createIngestExtractionTools(
	workspace: ExtractionWorkspaceApi,
	options?: IngestExtractionToolsOptions,
): ToolSet {
	const stageStatusTools = createReportAgentStageStatusTool({
		onToolExecuted: options?.onStageStatusReported,
	});

	return {
		...stageStatusTools,
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
							added: boolean;
							questionId: string;
							totalQuestions: number;
							alreadyExists?: true;
							message: string;
					  };
				try {
					const existingCount = workspace.listQuestions().length;
					const question = workspace.addQuestion(parsedInput);
					const alreadyExists =
						workspace.listQuestions().length === existingCount;
					output = {
						ok: true as const,
						added: !alreadyExists,
						questionId: question.questionId,
						totalQuestions: workspace.listQuestions().length,
						...(alreadyExists
							? {
									alreadyExists: true as const,
									message:
										"This question is already registered. Stop calling add_extracted_question. Use update_extracted_question only if a correction is needed.",
								}
							: {
									message:
										"Question registered. Continue only if more distinct source questions remain; otherwise stop.",
								}),
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
							updatedFields: ExtractionUpdatedField[];
							message: string;
					  };
				try {
					if (!hasMeaningfulQuestionPatch(parsedInput)) {
						const updatedFields: ExtractionUpdatedField[] = [];
						output = {
							ok: true as const,
							questionId: parsedInput.questionId,
							updatedFields,
							message: buildUpdateSuccessMessage(
								parsedInput.questionId,
								updatedFields,
							),
						};
					} else {
						const updatedFields = collectUpdatedFields(parsedInput);
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
							updatedFields,
							message: buildUpdateSuccessMessage(
								parsedInput.questionId,
								updatedFields,
							),
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
					message: buildListSuccessMessage(questions.length),
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
