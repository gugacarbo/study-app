import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startAttempt } from "@/functions/quiz/start-attempt";
import { activeAttemptQueryKey } from "@/features/quiz/hooks/use-active-attempt";
import type { Attempt, QuizConfig } from "@/features/quiz/types/quiz";

export function useStartAttempt(examId: string) {
	const queryClient = useQueryClient();

	return useMutation<Attempt, Error, QuizConfig>({
		mutationFn: (config) =>
			startAttempt({
				data: { examId, ...config },
			}),
		onSuccess: () => {
			return queryClient.invalidateQueries({
				queryKey: activeAttemptQueryKey(examId),
			});
		},
	});
}
