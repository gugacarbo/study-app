import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserJobsTable } from "@/features/background-processes/components/user-jobs-table";
import { useUserJobs } from "@/features/background-processes/hooks/use-user-jobs";

type UserJobsPageProps = {
	page: number;
	onPageChange: (page: number) => void;
};

export function UserJobsPageSkeleton() {
	return <Skeleton data-testid="user-jobs-skeleton" className="h-64 w-full" />;
}

export function UserJobsPageContent({ page, onPageChange }: UserJobsPageProps) {
	const { data } = useUserJobs(page);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
			<div className="space-y-2">
				<h2 className="font-serif text-2xl font-medium tracking-tight">
					Meus jobs
				</h2>
				<p className="text-sm text-muted-foreground">
					Veja o histórico dos seus jobs e abra cada monitor quando precisar.
				</p>
			</div>
			<UserJobsTable
				jobs={data.rows}
				page={data.page}
				pageSize={data.pageSize}
				total={data.total}
				onPageChange={onPageChange}
			/>
		</div>
	);
}

export function UserJobsPage({ page, onPageChange }: UserJobsPageProps) {
	return (
		<Suspense fallback={<UserJobsPageSkeleton />}>
			<UserJobsPageContent page={page} onPageChange={onPageChange} />
		</Suspense>
	);
}
