import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	cancelAdminJob,
	getAdminJobDetail,
	listAdminJobs,
	type AdminJobDetail,
} from "@/functions/admin/jobs";
import { isCancellableJobStatus } from "@/lib/job-kinds";

export const ADMIN_JOBS_KEY = ["admin", "jobs"] as const;

export function adminJobDetailKey(jobId: string) {
	return [...ADMIN_JOBS_KEY, "detail", jobId] as const;
}

export type AdminJobListItem = Awaited<
	ReturnType<typeof listAdminJobs>
>[number];

export type { AdminJobDetail };

export function useAdminJobs() {
	const queryClient = useQueryClient();

	const listQuery = useSuspenseQuery({
		queryKey: ADMIN_JOBS_KEY,
		queryFn: () => listAdminJobs(),
	});

	const cancelMutation = useMutation({
		mutationFn: (jobId: string) => cancelAdminJob({ data: { jobId } }),
		onSuccess: (_data, jobId) => {
			void queryClient.invalidateQueries({ queryKey: ADMIN_JOBS_KEY });
			void queryClient.invalidateQueries({
				queryKey: adminJobDetailKey(jobId),
			});
		},
	});

	return { ...listQuery, cancelJob: cancelMutation };
}

export function useAdminJobDetail(jobId: string | null) {
	return useQuery<AdminJobDetail>({
		queryKey: jobId ? adminJobDetailKey(jobId) : ["admin", "jobs", "detail", "none"],
		queryFn: (): Promise<AdminJobDetail> => {
			if (!jobId) throw new Error("jobId required");
			return getAdminJobDetail({ data: { jobId } });
		},
		enabled: jobId != null,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (!status || !isCancellableJobStatus(status)) return false;
			return 2000;
		},
	});
}
