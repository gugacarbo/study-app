import { useSuspenseQuery } from "@tanstack/react-query";
import { getActiveAttempt } from "@/functions/quiz/get-active-attempt";
import type { ActiveAttempt } from "@/features/quiz/types/quiz";

export function activeAttemptQueryKey(examId: string) {
	return ["quiz", "active-attempt", examId] as const;
}

export function useActiveAttempt(examId: string) {
	return useSuspenseQuery<ActiveAttempt | null>({
		queryKey: activeAttemptQueryKey(examId),
		queryFn: () => getActiveAttempt({ data: { examId } }),
	});
}
