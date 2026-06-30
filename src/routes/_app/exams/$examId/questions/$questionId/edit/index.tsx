import { createFileRoute } from "@tanstack/react-router";
import { ExamQuestionReviewPage } from "@/features/exams/pages/exam-question-review-page";

export const Route = createFileRoute(
	"/_app/exams/$examId/questions/$questionId/edit/",
)({
	component: ExamQuestionEditRoutePage,
});

function ExamQuestionEditRoutePage() {
	const { examId, questionId } = Route.useParams();
	return <ExamQuestionReviewPage examId={examId} questionId={questionId} />;
}
