import { createFileRoute } from "@tanstack/react-router";
import { QuizResultPage } from "@/features/quiz/pages/quiz-result-page";

export const Route = createFileRoute("/_app/exams/$examId/quiz/$attemptId/result")({
	component: QuizResultRoutePage,
});

function QuizResultRoutePage() {
	const { attemptId, examId } = Route.useParams();
	return <QuizResultPage attemptId={attemptId} examId={examId} />;
}
