import type { DraftQuestion } from "@/features/ai/agents/improve-options/contracts";
import { normalizeAnswerSet } from "@/lib/answer-scoring";
import {
	IMPROVE_OPTIONS_TOOL_ERROR_CODE,
	QUESTION_NOT_FOUND_ERROR_CODE,
	improveOptionsOptionsSchema,
} from "./shared";

export type ImproveOptionsUpdatedField = "options" | "answer" | "explanation";

export interface ImproveOptionsWorkspaceState {
	questions: DraftQuestion[];
	baselines: Map<number, DraftQuestion>;
}

export class ImproveOptionsWorkspaceError extends Error {
	code: string;

	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = "ImproveOptionsWorkspaceError";
	}
}

function cloneQuestion(question: DraftQuestion): DraftQuestion {
	return {
		...question,
		options: [...question.options],
		answers: [...question.answers],
	};
}

function omitUndefined<T extends Record<string, unknown>>(
	input: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as Partial<T>;
}

function answersInOptions(answers: string[], options: string[]): boolean {
	const optionSet = new Set(
		options.map((option) => option.trim().toLowerCase()),
	);
	return answers.every((answer) =>
		optionSet.has(answer.trim().toLowerCase()),
	);
}

function answersEqual(left: string[], right: string[]): boolean {
	const leftSet = normalizeAnswerSet(left);
	const rightSet = normalizeAnswerSet(right);
	if (leftSet.size !== rightSet.size) return false;
	for (const answer of leftSet) {
		if (!rightSet.has(answer)) return false;
	}
	return true;
}

function normalizeDraftQuestion(
	input: Pick<
		DraftQuestion,
		"question" | "options" | "answers" | "scoringMode" | "explanation"
	> &
		Partial<Pick<DraftQuestion, "id" | "exam_id" | "deepExplanation" | "topic">>,
): DraftQuestion {
	const parsedOptions = improveOptionsOptionsSchema.safeParse(input.options);
	if (!parsedOptions.success) {
		throw new ImproveOptionsWorkspaceError(
			IMPROVE_OPTIONS_TOOL_ERROR_CODE,
			parsedOptions.error.issues[0]?.message ??
				"Question must have at least 5 options.",
		);
	}

	const answers = input.answers
		.map((answer) => answer.trim())
		.filter(Boolean);
	if (answers.length === 0) {
		throw new ImproveOptionsWorkspaceError(
			IMPROVE_OPTIONS_TOOL_ERROR_CODE,
			"At least one answer is required.",
		);
	}

	if (!answersInOptions(answers, parsedOptions.data)) {
		throw new ImproveOptionsWorkspaceError(
			IMPROVE_OPTIONS_TOOL_ERROR_CODE,
			"Every answer must match one of the question options.",
		);
	}

	return {
		id: input.id ?? 0,
		question: input.question,
		options: parsedOptions.data,
		answers,
		scoringMode: input.scoringMode ?? "exact",
		explanation: input.explanation,
		...(input.exam_id !== undefined ? { exam_id: input.exam_id } : {}),
		...(input.deepExplanation !== undefined
			? { deepExplanation: input.deepExplanation }
			: {}),
		...(input.topic !== undefined ? { topic: input.topic } : {}),
	};
}

function diffUpdatedFields(
	baseline: DraftQuestion,
	current: DraftQuestion,
): ImproveOptionsUpdatedField[] {
	const fields: ImproveOptionsUpdatedField[] = [];

	if (
		baseline.options.length !== current.options.length ||
		baseline.options.some((option, index) => option !== current.options[index])
	) {
		fields.push("options");
	}

	if (!answersEqual(baseline.answers, current.answers)) {
		fields.push("answer");
	}

	if (baseline.explanation !== current.explanation) {
		fields.push("explanation");
	}

	return fields;
}

export function createImproveOptionsWorkspace(
	initial?: Partial<ImproveOptionsWorkspaceState> & {
		questions?: DraftQuestion[];
	},
) {
	const state: ImproveOptionsWorkspaceState = {
		questions: initial?.questions
			? initial.questions.map((question) => cloneQuestion(question))
			: [],
		baselines: initial?.baselines
			? new Map(
					[...initial.baselines.entries()].map(([id, question]) => [
						id,
						cloneQuestion(question),
					]),
				)
			: new Map(),
	};

	for (const question of state.questions) {
		if (!state.baselines.has(question.id)) {
			state.baselines.set(question.id, cloneQuestion(question));
		}
	}

	return {
		getQuestion(id: number) {
			const question = state.questions.find((item) => item.id === id);
			if (!question) {
				throw new ImproveOptionsWorkspaceError(
					QUESTION_NOT_FOUND_ERROR_CODE,
					`Question ${id} was not found in the improve-options workspace.`,
				);
			}

			return cloneQuestion(question);
		},

		listQuestions(): DraftQuestion[] {
			return state.questions.map((question) => cloneQuestion(question));
		},

		getUpdatedFields(id: number): ImproveOptionsUpdatedField[] {
			const question = state.questions.find((item) => item.id === id);
			if (!question) {
				throw new ImproveOptionsWorkspaceError(
					QUESTION_NOT_FOUND_ERROR_CODE,
					`Question ${id} was not found in the improve-options workspace.`,
				);
			}

			const baseline = state.baselines.get(id);
			if (!baseline) {
				return [];
			}

			return diffUpdatedFields(baseline, question);
		},

		updateQuestion(
			id: number,
			patch: Partial<
				Pick<
					DraftQuestion,
					"options" | "answers" | "scoringMode" | "explanation"
				>
			>,
		) {
			const index = state.questions.findIndex((item) => item.id === id);
			if (index === -1) {
				throw new ImproveOptionsWorkspaceError(
					QUESTION_NOT_FOUND_ERROR_CODE,
					`Question ${id} was not found in the improve-options workspace.`,
				);
			}

			const current = state.questions[index];
			const merged = normalizeDraftQuestion({
				...current,
				...omitUndefined(patch),
			});
			const updated: DraftQuestion = {
				...merged,
				id,
			};
			state.questions[index] = updated;

			return updated;
		},

		getState(): ImproveOptionsWorkspaceState {
			return {
				questions: state.questions.map((question) => cloneQuestion(question)),
				baselines: new Map(
					[...state.baselines.entries()].map(([id, question]) => [
						id,
						cloneQuestion(question),
					]),
				),
			};
		},
	};
}
