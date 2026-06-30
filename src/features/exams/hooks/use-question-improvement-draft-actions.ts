import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type ResolveQuestionImprovementDraftInput,
	resolveQuestionImprovementDraft,
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
		resolveDraft: useMutation({
			mutationFn: (input: ResolveQuestionImprovementDraftInput) =>
				resolveQuestionImprovementDraft({ data: input }),
			onSuccess,
		}),
	};
}
