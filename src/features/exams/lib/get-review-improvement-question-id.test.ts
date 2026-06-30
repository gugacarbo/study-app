import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { describe, expect, it } from "vitest";
import { getReviewImprovementQuestionId } from "@/features/exams/lib/get-review-improvement-question-id";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

const questions: QuestionDetail[] = [
	{
		id: "q1",
		question: "Questão 1",
		options: [],
		answers: [],
		topic: "Tema 1",
		scoringMode: "exact",
		explanation: null,
		deepExplanation: null,
	},
	{
		id: "q2",
		question: "Questão 2",
		options: [],
		answers: [],
		topic: "Tema 2",
		scoringMode: "exact",
		explanation: null,
		deepExplanation: null,
	},
	{
		id: "q3",
		question: "Questão 3",
		options: [],
		answers: [],
		topic: "Tema 3",
		scoringMode: "exact",
		explanation: null,
		deepExplanation: null,
	},
];

function buildDraft(
	questionId: string,
	overrides: Partial<QuestionImprovementDraftRecord> = {},
): QuestionImprovementDraftRecord {
	return {
		id: `draft-${questionId}`,
		userId: "user-1",
		examId: "exam-1",
		questionId,
		jobId: "job-1",
		status: "pending_review",
		originalSnapshot: {
			question: "Original",
			options: [],
			answers: [],
			topic: "Tema",
			scoringMode: "exact",
			explanation: null,
			deepExplanation: null,
		},
		improvedSnapshot: {
			question: "Melhorada",
			options: [],
			answers: [],
			topic: "Tema",
			scoringMode: "exact",
			explanation: null,
			deepExplanation: null,
		},
		summary: null,
		metadata: null,
		createdAt: null,
		updatedAt: null,
		...overrides,
	};
}

describe("getReviewImprovementQuestionId", () => {
	it("returns null when there are no pending drafts", () => {
		expect(getReviewImprovementQuestionId(questions, [])).toBeNull();
	});

	it("returns the first pending question by exam order even when drafts arrive out of order", () => {
		const drafts = [buildDraft("q3"), buildDraft("q2")];

		expect(getReviewImprovementQuestionId(questions, drafts)).toBe("q2");
	});

	it("falls back to the first draft question id when all drafts are stale", () => {
		const drafts = [buildDraft("stale-q2"), buildDraft("stale-q1")];

		expect(getReviewImprovementQuestionId(questions, drafts)).toBe("stale-q2");
	});
});
