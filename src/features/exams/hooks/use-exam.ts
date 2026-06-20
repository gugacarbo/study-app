import { useSuspenseQuery } from "@tanstack/react-query";
import { getExam } from "@/functions/exams/get-exam";

export function examQueryKey(examId: string) {
	return ["exams", examId] as const;
}

export function useExam(examId: string) {
	return useSuspenseQuery({
		queryKey: examQueryKey(examId),
		queryFn: () => getExam({ data: { examId } }),
	});
}
