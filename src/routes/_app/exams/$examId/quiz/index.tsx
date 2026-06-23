import { createFileRoute } from "@tanstack/react-router";
import { QuizConfigPage } from "@/features/quiz/pages/quiz-config-page";

export const Route = createFileRoute("/_app/exams/$examId/quiz/")({
	component: QuizConfigRoutePage,
});

function QuizConfigRoutePage() {
	const { examId } = Route.useParams();
	return <QuizConfigPage examId={examId} />;
}
