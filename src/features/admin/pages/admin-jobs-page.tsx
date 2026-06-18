import { Suspense, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { JobDetailSheet } from "@/features/admin/components/job-detail-sheet";
import { JobsTable } from "@/features/admin/components/jobs-table";
import { useAdminJobs } from "@/features/admin/hooks/use-admin-jobs";

function JobsSkeleton() {
	return <Skeleton className="h-64 w-full" />;
}

export function AdminJobsPageContent() {
	const { data: jobs, cancelJob } = useAdminJobs();
	const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	function handleSelectJob(jobId: string) {
		setSelectedJobId(jobId);
		setSheetOpen(true);
	}

	return (
		<>
			<JobsTable
				jobs={jobs}
				selectedJobId={selectedJobId}
				onSelectJob={handleSelectJob}
			/>
			<JobDetailSheet
				jobId={selectedJobId}
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				onCancel={async (jobId) => {
					await cancelJob.mutateAsync(jobId);
				}}
			/>
		</>
	);
}

export function AdminJobsPage() {
	return (
		<Suspense fallback={<JobsSkeleton />}>
			<AdminJobsPageContent />
		</Suspense>
	);
}
