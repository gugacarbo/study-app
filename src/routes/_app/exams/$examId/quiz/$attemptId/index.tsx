import { createFileRoute } from "@tanstack/react-router";
import { QuizSessionPage } from "@/features/quiz/pages/quiz-session-page";

export const Route = createFileRoute("/_app/exams/$examId/quiz/$attemptId/")({
	component: QuizSessionRoutePage,
});

function QuizSessionRoutePage() {
	const { examId, attemptId } = Route.useParams();
	return <QuizSessionPage examId={examId} attemptId={attemptId} />;
}
