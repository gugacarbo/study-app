import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamDetailActions } from "@/features/exams/components/exam-detail-actions";
import { ExamDetailHeader } from "@/features/exams/components/exam-detail-header";
import { ExamQuestionList } from "@/features/exams/components/exam-question-list";
import { useExam } from "@/features/exams/hooks/use-exam";

type ExamDetailPageProps = {
	examId: string;
};

function ExamDetailPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<Skeleton className="h-7 w-64" />
				<Skeleton className="h-4 w-40" />
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-7 w-28" />
				<Skeleton className="h-7 w-28" />
			</div>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-14 w-full" />
				<Skeleton className="h-14 w-full" />
			</div>
		</div>
	);
}

export function ExamDetailPageContent({ examId }: ExamDetailPageProps) {
	const { data: exam } = useExam(examId);

	return (
		<div className="flex flex-col gap-6">
			<ExamDetailHeader exam={exam} />
			<ExamDetailActions />
			<ExamQuestionList questions={exam.questions} />
		</div>
	);
}

export function ExamDetailPage({ examId }: ExamDetailPageProps) {
	return (
		<Suspense fallback={<ExamDetailPageSkeleton />}>
			<ExamDetailPageContent examId={examId} />
		</Suspense>
	);
}
