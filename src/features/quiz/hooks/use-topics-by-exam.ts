import { useSuspenseQuery } from "@tanstack/react-query";
import type { ExamTopicOption } from "@/db/queries/attempts";
import { listExamTopics } from "@/functions/quiz/list-exam-topics";

export function examTopicsQueryKey(examId: string) {
	return ["quiz", "exam-topics", examId] as const;
}

export function useTopicsByExam(examId: string) {
	return useSuspenseQuery<ExamTopicOption[]>({
		queryKey: examTopicsQueryKey(examId),
		queryFn: () => listExamTopics({ data: { examId } }),
	});
}
