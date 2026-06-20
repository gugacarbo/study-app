import { useSuspenseQuery } from "@tanstack/react-query";
import { listExams } from "@/functions/exams/list-exams";

export const EXAMS_QUERY_KEY = ["exams"] as const;

export type ExamListItem = Awaited<ReturnType<typeof listExams>>[number];

export function useExams() {
	return useSuspenseQuery({
		queryKey: EXAMS_QUERY_KEY,
		queryFn: () => listExams(),
	});
}
