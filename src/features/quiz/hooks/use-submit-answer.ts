import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitAnswer } from "@/functions/quiz/submit-answer";
import { activeAttemptQueryKey } from "@/features/quiz/hooks/use-active-attempt";

export type SubmitAnswerInput = {
	attemptId: string;
	questionId: string;
	selectedOptions: string[];
};

export function useSubmitAnswer(attemptId: string, examId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: Omit<SubmitAnswerInput, "attemptId">) =>
			submitAnswer({ data: { attemptId, ...input } }),
		onSuccess: () => {
			return queryClient.invalidateQueries({
				queryKey: activeAttemptQueryKey(examId),
			});
		},
	});
}
