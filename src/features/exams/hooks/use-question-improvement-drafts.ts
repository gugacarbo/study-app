import { useQuery } from "@tanstack/react-query";
import { getQuestionImprovementDrafts } from "@/functions/exams/question-improvement-drafts";

export function questionImprovementDraftsQueryKey(examId: string) {
	return ["question-improvement-drafts", examId] as const;
}

export function useQuestionImprovementDrafts(examId: string) {
	return useQuery({
		queryKey: questionImprovementDraftsQueryKey(examId),
		queryFn: () => getQuestionImprovementDrafts({ data: { examId } }),
	});
}
