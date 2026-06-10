import { type ToolExecutionContext, toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { Question } from "@/lib/validation";
import {
	type ExtractionQuestionFields,
	type ExtractionQuestionPatch,
	extractionQuestionFieldsSchema,
	extractionQuestionIdSchema,
	extractionQuestionPatchSchema,
	extractionToolFailureSchema,
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

const extractionToolSuccessSchema = z.object({
	ok: z.literal(true),
	questionId: extractionQuestionIdSchema,
	totalQuestions: z.number().int().min(0),
});

const updateExtractionQuestionSuccessSchema = z.object({
	ok: z.literal(true),
	questionId: extractionQuestionIdSchema,
	updatedFields: z.array(
		z.enum([
			"question",
			"options",
			"answers",
			"scoringMode",
			"topic",
			"explanation",
		]),
	),
});

const listExtractionQuestionsSuccessSchema = z.object({
	ok: z.literal(true),
	totalQuestions: z.number().int().min(0),
	data: z.array(
		z.object({
			questionId: extractionQuestionIdSchema,
			question: z.string(),
			options: z.array(z.string()),
			answers: z.array(z.string()),
			scoringMode: z.enum(["exact", "partial"]),
			topic: z.string(),
		}),
	),
});

const addExtractedQuestionDef = toolDefinition({
	name: "add_extracted_question",
	description:
		"Add one extracted exam question to the current ingest workspace.",
	inputSchema: extractionQuestionFieldsSchema,
	outputSchema: z.union([
		extractionToolSuccessSchema,
		extractionToolFailureSchema,
	]),
});

const updateExtractedQuestionDef = toolDefinition({
	name: "update_extracted_question",
	description:
		"Update a previously added extracted exam question by its workspace questionId. Pass only fields that need correction; omit unchanged fields. A call with only questionId and no field changes is a no-op.",
	inputSchema: extractionQuestionPatchSchema,
	outputSchema: z.union([
		updateExtractionQuestionSuccessSchema,
		extractionToolFailureSchema,
	]),
});

const listExtractedQuestionsDef = toolDefinition({
	name: "list_extracted_questions",
	description:
		"List the extracted questions currently stored in the ingest workspace.",
	inputSchema: z.object({}),
	outputSchema: z.union([
		listExtractionQuestionsSuccessSchema,
		extractionToolFailureSchema,
	]),
});

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

export function createIngestExtractionTools(
	workspace: ExtractionWorkspaceApi,
	options?: {
		onToolExecuted?: (event: IngestToolExecutedEvent) => void | Promise<void>;
	},
) {
	const addExtractedQuestion = addExtractedQuestionDef.server(
		async (input, context) => {
			const parsedInput = input as ExtractionQuestionFields;
			let output:
				| Awaited<ReturnType<typeof toToolFailure>>
				| {
						ok: true;
						questionId: string;
						totalQuestions: number;
				  };
			try {
				const question = workspace.addQuestion(parsedInput);
				output = {
					ok: true as const,
					questionId: question.questionId,
					totalQuestions: workspace.listQuestions().length,
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
	);

	const updateExtractedQuestion = updateExtractedQuestionDef.server(
		async (input, context) => {
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
	);

	const listExtractedQuestions = listExtractedQuestionsDef.server(
		async (_input, context) => {
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
	);

	return [
		addExtractedQuestion,
		updateExtractedQuestion,
		listExtractedQuestions,
	] as const;
}
