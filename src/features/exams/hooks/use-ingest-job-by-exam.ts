import { useQuery } from "@tanstack/react-query";
import { getIngestJobIdByExam } from "@/functions/jobs/get-ingest-job-id-by-exam";

export function useIngestJobByExam(examId: string) {
	return useQuery({
		queryKey: ["ingest-job-id", examId],
		queryFn: () =>
			getIngestJobIdByExam({ data: { examId } }),
	});
}
