import type { ExplanationBatchInput } from "@/features/ai/agents/explanations/generate-explanations/types";
import { explanationBatchSchema } from "@/features/ai/agents/explanations/generate-explanations/types";
import {
	EXPLANATION_TOOL_ERROR_CODE,
	QUESTION_NOT_FOUND_ERROR_CODE,
} from "./shared";

export interface ExplanationWorkspaceQuestion extends ExplanationBatchInput {
	explanation: string;
	deepExplanation: string;
}

export class ExplanationWorkspaceError extends Error {
	code: string;

	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = "ExplanationWorkspaceError";
	}
}

function omitUndefined<T extends Record<string, unknown>>(
	input: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as Partial<T>;
}

function normalizeExplanationFields(patch: {
	explanation?: string;
	deepExplanation?: string;
}) {
	const explanation = patch.explanation?.trim();
	const deepExplanation = patch.deepExplanation?.trim();

	if (explanation != null && explanation.length === 0) {
		throw new ExplanationWorkspaceError(
			EXPLANATION_TOOL_ERROR_CODE,
			"Explanation cannot be empty.",
		);
	}

	if (deepExplanation != null && deepExplanation.length === 0) {
		throw new ExplanationWorkspaceError(
			EXPLANATION_TOOL_ERROR_CODE,
			"Deep explanation cannot be empty.",
		);
	}

	return {
		explanation,
		deepExplanation,
	};
}

export function createExplanationWorkspace(questions: ExplanationBatchInput[]) {
	const state: ExplanationWorkspaceQuestion[] = questions.map((question) => ({
		...question,
		scoringMode: question.scoringMode ?? "exact",
		explanation: question.explanation ?? "",
		deepExplanation:
			"deepExplanation" in question &&
			typeof question.deepExplanation === "string"
				? question.deepExplanation
				: "",
	}));

	return {
		getQuestion(questionId: number) {
			const question = state.find((item) => item.id === questionId);
			if (!question) {
				throw new ExplanationWorkspaceError(
					QUESTION_NOT_FOUND_ERROR_CODE,
					`Question ${questionId} was not found in the current explanation workspace.`,
				);
			}
			return { ...question };
		},

		updateQuestionExplanation(
			questionId: number,
			patch: { explanation?: string; deepExplanation?: string },
		) {
			const index = state.findIndex((question) => question.id === questionId);
			if (index === -1) {
				throw new ExplanationWorkspaceError(
					QUESTION_NOT_FOUND_ERROR_CODE,
					`Question ${questionId} was not found in the current explanation workspace.`,
				);
			}

			const normalized = normalizeExplanationFields(patch);
			const current = state[index];
			state[index] = {
				...current,
				...omitUndefined(normalized),
			};

			return state[index];
		},

		listQuestions(): ExplanationWorkspaceQuestion[] {
			return state.map((question) => ({ ...question }));
		},

		buildResult() {
			const incomplete = state.filter(
				(question) =>
					!question.explanation.trim() || !question.deepExplanation.trim(),
			);

			if (incomplete.length > 0) {
				const missingIds = incomplete.map((question) => question.id).join(", ");
				throw new ExplanationWorkspaceError(
					EXPLANATION_TOOL_ERROR_CODE,
					`Missing explanations for question id(s): ${missingIds}.`,
				);
			}

			return explanationBatchSchema.parse({
				questions: state.map((question) => ({
					id: question.id,
					explanation: question.explanation.trim(),
					deepExplanation: question.deepExplanation.trim(),
				})),
			});
		},
	};
}
