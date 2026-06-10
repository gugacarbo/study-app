import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
	explanationPatchSchema,
	explanationQuestionIdSchema,
	explanationToolFailureSchema,
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

const updateQuestionExplanationSuccessSchema = z.object({
	ok: z.literal(true),
	questionId: explanationQuestionIdSchema,
	updatedFields: z.array(z.enum(["explanation", "deepExplanation"])),
});

const listExplanationQuestionsSuccessSchema = z.object({
	ok: z.literal(true),
	data: z.array(
		z.object({
			id: explanationQuestionIdSchema,
			question: z.string(),
			options: z.array(z.string()),
			answers: z.array(z.string()),
			topic: z.string(),
			explanation: z.string(),
			hasExplanation: z.boolean(),
			hasDeepExplanation: z.boolean(),
		}),
	),
});

const updateQuestionExplanationDef = toolDefinition({
	name: "update_question_explanation",
	description:
		"Write explanation and deepExplanation for one question. questionId, explanation, and deepExplanation are all required.",
	inputSchema: explanationPatchSchema,
	outputSchema: z.union([
		updateQuestionExplanationSuccessSchema,
		explanationToolFailureSchema,
	]),
});

const listExplanationQuestionsDef = toolDefinition({
	name: "list_explanation_questions",
	description:
		"List the questions currently stored in the explanation workspace.",
	inputSchema: z.object({}),
	outputSchema: z.union([
		listExplanationQuestionsSuccessSchema,
		explanationToolFailureSchema,
	]),
});

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

export function createExplanationTools(workspace: ExplanationWorkspaceApi) {
	const updateQuestionExplanation = updateQuestionExplanationDef.server(
		async (input) => {
			try {
				workspace.updateQuestionExplanation(input.questionId, {
					explanation: input.explanation,
					deepExplanation: input.deepExplanation,
				});

				return {
					ok: true as const,
					questionId: input.questionId,
					updatedFields: ["explanation", "deepExplanation"] as const,
				};
			} catch (error) {
				return toToolFailure(error);
			}
		},
	);

	const listExplanationQuestions = listExplanationQuestionsDef.server(
		async () => ({
			ok: true as const,
			data: workspace.listQuestions().map((question) => ({
				id: question.id,
				question: question.question,
				options: [...question.options],
				answers: [...question.answers],
				topic: question.topic ?? "General",
				explanation: question.explanation ?? "",
				hasExplanation: Boolean(question.explanation?.trim()),
				hasDeepExplanation: Boolean(question.deepExplanation?.trim()),
			})),
		}),
	);

	return [updateQuestionExplanation, listExplanationQuestions] as const;
}
