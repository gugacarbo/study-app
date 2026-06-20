import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamsList } from "@/features/exams/components/exams-list";
import { useExams } from "@/features/exams/hooks/use-exams";

function ExamsPageSkeleton() {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-5 w-40" />
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-24 w-full" />
		</div>
	);
}

function ExamsPageContent() {
	const { data: exams } = useExams();
	return <ExamsList exams={exams} />;
}

export function ExamsPage() {
	return (
		<Suspense fallback={<ExamsPageSkeleton />}>
			<ExamsPageContent />
		</Suspense>
	);
}
