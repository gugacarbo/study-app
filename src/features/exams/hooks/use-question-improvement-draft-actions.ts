import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	approveQuestionImprovementDraft,
	discardQuestionImprovementDraft,
} from "@/functions/exams/question-improvement-drafts";
import { examQueryKey } from "@/features/exams/hooks/use-exam";
import { questionImprovementDraftsQueryKey } from "@/features/exams/hooks/use-question-improvement-drafts";

export function useQuestionImprovementDraftActions(examId: string) {
	const queryClient = useQueryClient();

	const onSuccess = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: examQueryKey(examId) }),
			queryClient.invalidateQueries({
				queryKey: questionImprovementDraftsQueryKey(examId),
			}),
		]);
	};

	return {
		approveDraft: useMutation({
			mutationFn: (input: { draftId: string }) =>
				approveQuestionImprovementDraft({ data: input }),
			onSuccess,
		}),
		discardDraft: useMutation({
			mutationFn: (input: { draftId: string }) =>
				discardQuestionImprovementDraft({ data: input }),
			onSuccess,
		}),
	};
}
