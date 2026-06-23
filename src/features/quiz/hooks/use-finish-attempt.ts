import { useMutation, useQueryClient } from "@tanstack/react-query";
import { finishAttempt } from "@/functions/quiz/finish-attempt";
import { getAttemptResult } from "@/functions/quiz/get-attempt-result";
import { activeAttemptQueryKey } from "@/features/quiz/hooks/use-active-attempt";
import type { AttemptResult } from "@/features/quiz/types/quiz";

export function finishAttemptQueryKey(attemptId: string) {
	return ["quiz", "attempt-result", attemptId] as const;
}

export function useFinishAttempt(attemptId: string, examId: string) {
	const queryClient = useQueryClient();

	return useMutation<AttemptResult, Error, void>({
		mutationFn: () => finishAttempt({ data: { attemptId } }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: activeAttemptQueryKey(examId),
			});
			void queryClient.prefetchQuery({
				queryKey: finishAttemptQueryKey(attemptId),
				queryFn: () => getAttemptResult({ data: { attemptId } }),
			});
		},
	});
}
