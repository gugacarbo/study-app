import { createFileRoute } from "@tanstack/react-router";
import { ExamDetailPage } from "@/features/exams/pages/exam-detail-page";

export const Route = createFileRoute("/_app/exams/$examId/")({
	component: ExamDetailRoutePage,
});

function ExamDetailRoutePage() {
	const { examId } = Route.useParams();
	return <ExamDetailPage examId={examId} />;
}
