import { toolDefinition } from "@tanstack/ai";
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

export function createIngestExtractionTools(workspace: ExtractionWorkspaceApi) {
	const addExtractedQuestion = addExtractedQuestionDef.server(async (input) => {
		try {
			const question = workspace.addQuestion(input);
			return {
				ok: true as const,
				questionId: question.questionId,
				totalQuestions: workspace.listQuestions().length,
			};
		} catch (error) {
			return toToolFailure(error);
		}
	});

	const updateExtractedQuestion = updateExtractedQuestionDef.server(
		async (input) => {
			try {
				if (!hasMeaningfulQuestionPatch(input)) {
					return {
						ok: true as const,
						questionId: input.questionId,
						updatedFields: [],
					};
				}

				workspace.updateQuestion(input.questionId as ExtractionQuestionId, {
					question: input.question ?? undefined,
					options: input.options ?? undefined,
					answer: input.answer ?? undefined,
					topic: input.topic ?? undefined,
					explanation: input.explanation ?? undefined,
				});
				return {
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
			} catch (error) {
				return toToolFailure(error);
			}
		},
	);

	const listExtractedQuestions = listExtractedQuestionsDef.server(async () => ({
		ok: true as const,
		data: workspace.listQuestions().map((question) => ({
			questionId: question.questionId,
			question: question.question,
			answer: question.answer,
			topic: question.topic ?? "General",
		})),
	}));

	return [
		addExtractedQuestion,
		updateExtractedQuestion,
		listExtractedQuestions,
	] as const;
}
