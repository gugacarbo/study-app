import { toolDefinition, type ToolExecutionContext } from "@tanstack/ai";
import { z } from "zod";
import type { Question } from "@/lib/validation";
import {
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
		input: Partial<Question> & Pick<Question, "question" | "answer">,
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
		z.enum(["question", "options", "answer", "topic", "explanation"]),
	),
});

const listExtractionQuestionsSuccessSchema = z.object({
	ok: z.literal(true),
	data: z.array(
		z.object({
			questionId: extractionQuestionIdSchema,
			question: z.string(),
			options: z.array(z.string()),
			answer: z.string(),
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

function hasMeaningfulQuestionPatch(input: {
	question?: string | null;
	options?: string[] | null;
	answer?: string | null;
	topic?: string | null;
	explanation?: string | null;
}) {
	return (
		input.question != null ||
		input.options != null ||
		input.answer != null ||
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
	options: { onToolExecuted?: (event: IngestToolExecutedEvent) => void | Promise<void> } | undefined,
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
			let output: Awaited<ReturnType<typeof toToolFailure>> | {
				ok: true;
				questionId: string;
				totalQuestions: number;
			};
			try {
				const question = workspace.addQuestion(input);
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
				input,
				output,
				context,
			);
			return output;
		},
	);

	const updateExtractedQuestion = updateExtractedQuestionDef.server(
		async (input, context) => {
			let output:
				| Awaited<ReturnType<typeof toToolFailure>>
				| {
						ok: true;
						questionId: string;
						updatedFields: Array<
							"question" | "options" | "answer" | "topic" | "explanation"
						>;
				  };
			try {
				if (!hasMeaningfulQuestionPatch(input)) {
					output = {
						ok: true as const,
						questionId: input.questionId,
						updatedFields: [],
					};
				} else {
					workspace.updateQuestion(input.questionId as ExtractionQuestionId, {
						question: input.question ?? undefined,
						options: input.options ?? undefined,
						answer: input.answer ?? undefined,
						topic: input.topic ?? undefined,
						explanation: input.explanation ?? undefined,
					});
					output = {
						ok: true as const,
						questionId: input.questionId,
						updatedFields: [
							...(input.question != null ? ["question" as const] : []),
							...(input.options != null ? ["options" as const] : []),
							...(input.answer != null ? ["answer" as const] : []),
							...(input.topic != null ? ["topic" as const] : []),
							...(input.explanation != null
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
				input,
				output,
				context,
			);
			return output;
		},
	);

	const listExtractedQuestions = listExtractedQuestionsDef.server(
		async (_input, context) => {
			const output = {
				ok: true as const,
				data: workspace.listQuestions().map((question) => ({
					questionId: question.questionId,
					question: question.question,
					options: [...question.options],
					answer: question.answer,
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
