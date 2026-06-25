import { createFileRoute } from "@tanstack/react-router";
import { ExamQuestionPage } from "@/features/exams/pages/exam-question-page";

export const Route = createFileRoute(
	"/_app/exams/$examId/questions/$questionId/",
)({
	component: ExamQuestionRoutePage,
});

function ExamQuestionRoutePage() {
	const { examId, questionId } = Route.useParams();
	return <ExamQuestionPage examId={examId} questionId={questionId} />;
}
