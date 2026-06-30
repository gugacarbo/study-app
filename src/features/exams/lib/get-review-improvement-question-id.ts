import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

export function getReviewImprovementQuestionId(
	questions: QuestionDetail[],
	drafts: QuestionImprovementDraftRecord[],
): string | null {
	if (drafts.length === 0) {
		return null;
	}

	const draftQuestionIds = new Set(drafts.map((draft) => draft.questionId));

	for (const question of questions) {
		if (draftQuestionIds.has(question.id)) {
			return question.id;
		}
	}

	return drafts[0]?.questionId ?? null;
}
