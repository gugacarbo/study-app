import { useQuery } from "@tanstack/react-query";
import type { ActiveJobSummary } from "@/functions/jobs/list-active-jobs";

export type ActiveJobsResponse = {
	jobs: ActiveJobSummary[];
};

const ACTIVE_JOBS_POLL_MS = 5000;
const IDLE_JOBS_POLL_MS = 30000;

export const ACTIVE_JOBS_QUERY_KEY = ["active-jobs"] as const;

async function fetchActiveJobs(): Promise<ActiveJobsResponse> {
	const response = await fetch("/api/jobs/active");
	if (!response.ok) {
		throw new Error(`Erro HTTP ${response.status}`);
	}
	return response.json() as Promise<ActiveJobsResponse>;
}

export function useActiveJobs() {
	return useQuery({
		queryKey: ACTIVE_JOBS_QUERY_KEY,
		queryFn: fetchActiveJobs,
		refetchInterval: (query) =>
			(query.state.data?.jobs.length ?? 0) > 0
				? ACTIVE_JOBS_POLL_MS
				: IDLE_JOBS_POLL_MS,
	});
}
