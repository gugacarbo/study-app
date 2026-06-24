import { useSuspenseQuery } from "@tanstack/react-query";
import { listExamAttempts } from "@/functions/quiz/list-exam-attempts";
import type { AttemptSummary } from "@/features/quiz/types/quiz";

export function examAttemptsQueryKey(examId: string) {
	return ["quiz", "exam-attempts", examId] as const;
}

export function useExamAttempts(examId: string) {
	return useSuspenseQuery<AttemptSummary[]>({
		queryKey: examAttemptsQueryKey(examId),
		queryFn: async () => {
			const result = await listExamAttempts({ data: { examId } });
			return result.map((attempt, index) => ({
				...attempt,
				number: index + 1,
				accuracy: attempt.scorePercent,
			}));
		},
	});
}
