import { useSuspenseQuery } from "@tanstack/react-query";
import { getAttemptResult } from "@/functions/quiz/get-attempt-result";
import type { AttemptResult } from "@/features/quiz/types/quiz";

export function attemptResultQueryKey(attemptId: string) {
	return ["quiz", "attempt-result", attemptId] as const;
}

export function useAttemptResult(attemptId: string) {
	return useSuspenseQuery<AttemptResult>({
		queryKey: attemptResultQueryKey(attemptId),
		queryFn: () => getAttemptResult({ data: { attemptId } }),
	});
}
