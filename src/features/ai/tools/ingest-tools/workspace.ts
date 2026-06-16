import type { Question } from "@/lib/validation";
import {
	examIngestResponseSchema,
	ingestQuestionSchema,
} from "@/lib/validation";
import {
	INGEST_TOOL_ERROR_CODE,
	QUESTION_NOT_FOUND_ERROR_CODE,
} from "./shared";

export type ExtractionQuestionId = `q${number}`;

export function formatExtractionQuestionId(
	questionNumber: number,
): ExtractionQuestionId {
	return `q${questionNumber}`;
}

export interface ExtractionWorkspaceQuestion extends Question {
	questionId: ExtractionQuestionId;
}

export interface ExtractionWorkspaceState {
	examName: string;
	questions: ExtractionWorkspaceQuestion[];
	nextQuestionNumber: number;
}

export class ExtractionWorkspaceError extends Error {
	code: string;

	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = "ExtractionWorkspaceError";
	}
}

function formatError(error: unknown, fallbackMessage: string): string {
	if (
		typeof error === "object" &&
		error !== null &&
		"issues" in error &&
		Array.isArray(error.issues) &&
		error.issues.length > 0
	) {
		const firstIssue = error.issues[0];
		if (
			typeof firstIssue === "object" &&
			firstIssue !== null &&
			"message" in firstIssue &&
			typeof firstIssue.message === "string"
		) {
			return firstIssue.message;
		}
	}

	return error instanceof Error ? error.message : fallbackMessage;
}

function deriveTopics(questions: Question[]): string[] {
	return Array.from(
		new Set(
			questions
				.map((question) => question.topic?.trim() ?? "General")
				.filter(Boolean),
		),
	);
}

function omitUndefined<T extends Record<string, unknown>>(
	input: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as Partial<T>;
}

function normalizeQuestionKey(text: string): string {
	return text
		.trim()
		.replace(/^\*{0,2}\s*/, "")
		.replace(/^\d+[.):-]\s*/, "")
		.replace(/\*{1,2}$/, "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function normalizeQuestion(
	input: Partial<Question> & Pick<Question, "question" | "answers">,
): Question {
	const parsed = ingestQuestionSchema.safeParse({
		...input,
		explanation: "",
	});

	if (!parsed.success) {
		throw new ExtractionWorkspaceError(
			INGEST_TOOL_ERROR_CODE,
			formatError(parsed.error, "Unable to validate extracted question."),
		);
	}

	return {
		...parsed.data,
		explanation: "",
		topic: parsed.data.topic ?? "General",
	};
}

export function createExtractionWorkspace(
	initial?: Partial<ExtractionWorkspaceState>,
) {
	const state: ExtractionWorkspaceState = {
		examName: initial?.examName?.trim() || "Untitled exam",
		questions: initial?.questions ? [...initial.questions] : [],
		nextQuestionNumber: initial?.nextQuestionNumber ?? 1,
	};

	return {
		addQuestion(
			input: Partial<Question> & Pick<Question, "question" | "answers">,
		) {
			const question = normalizeQuestion(input);
			const questionKey = normalizeQuestionKey(question.question);
			const duplicate = state.questions.find(
				(existing) => normalizeQuestionKey(existing.question) === questionKey,
			);
			if (duplicate) {
				return duplicate;
			}

			const questionId = formatExtractionQuestionId(state.nextQuestionNumber);
			state.nextQuestionNumber += 1;

			const item: ExtractionWorkspaceQuestion = {
				questionId,
				...question,
			};
			state.questions.push(item);

			return item;
		},

		updateQuestion(questionId: ExtractionQuestionId, patch: Partial<Question>) {
			const index = state.questions.findIndex(
				(question) => question.questionId === questionId,
			);
			if (index === -1) {
				throw new ExtractionWorkspaceError(
					QUESTION_NOT_FOUND_ERROR_CODE,
					`Question ${questionId} was not found in the current extraction workspace.`,
				);
			}

			const current = state.questions[index];
			const nextQuestion = normalizeQuestion({
				...current,
				...omitUndefined(patch),
			});
			const updated: ExtractionWorkspaceQuestion = {
				questionId,
				...nextQuestion,
			};
			state.questions[index] = updated;

			return updated;
		},

		listQuestions(): ExtractionWorkspaceQuestion[] {
			return state.questions.map((question) => ({ ...question }));
		},

		buildResult() {
			const questions = state.questions.map(
				({ questionId: _questionId, ...question }) => question,
			);

			return examIngestResponseSchema.parse({
				examName: state.examName,
				questions,
				topics: deriveTopics(questions),
			});
		},

		getState(): ExtractionWorkspaceState {
			return {
				examName: state.examName,
				questions: [...state.questions],
				nextQuestionNumber: state.nextQuestionNumber,
			};
		},

		reset() {
			state.examName = "Untitled exam";
			state.questions = [];
			state.nextQuestionNumber = 1;
		},
	};
}
