import { useSuspenseQuery } from "@tanstack/react-query";
import { listUserJobs } from "@/functions/jobs/list-user-jobs";

export const USER_JOBS_QUERY_KEY = ["user-jobs"] as const;

export function useUserJobs(page: number) {
	return useSuspenseQuery({
		queryKey: [...USER_JOBS_QUERY_KEY, page] as const,
		queryFn: () => listUserJobs({ data: { page } }),
	});
}
