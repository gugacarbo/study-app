import { Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizAnswerReview } from "@/features/quiz/components/quiz-answer-review";
import { QuizResultSummary } from "@/features/quiz/components/quiz-result-summary";
import { useAttemptResult } from "@/features/quiz/hooks/use-attempt-result";
import { useStartAttempt } from "@/features/quiz/hooks/use-start-attempt";

type QuizResultPageProps = {
	examId: string;
	attemptId: string;
};

function QuizResultPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<Skeleton className="h-48 w-full" />
			<Skeleton className="h-32 w-full" />
			<Skeleton className="h-32 w-full" />
		</div>
	);
}

export function QuizResultPageContent({ examId, attemptId }: QuizResultPageProps) {
	const { data: result } = useAttemptResult(attemptId);
	const startAttempt = useStartAttempt(examId);
	const navigate = useNavigate();

	async function handleNewAttempt() {
		const attempt = await startAttempt.mutateAsync({
			order: "original",
			quantity: 0,
			topicFilter: null,
			revealMode: "after",
		});
		await navigate({
			to: "/exams/$examId/quiz/$attemptId",
			params: { examId, attemptId: attempt.id },
		});
	}

	return (
		<div className="flex flex-col gap-6">
			<QuizResultSummary
				scorePercent={result.scorePercent}
				totalQuestions={result.totalQuestions}
				answeredQuestions={result.answeredQuestions}
				correctAnswers={result.correctAnswers}
				onNewAttempt={handleNewAttempt}
				isStarting={startAttempt.isPending}
			/>
			<QuizAnswerReview result={result} />
		</div>
	);
}

export function QuizResultPage({ examId, attemptId }: QuizResultPageProps) {
	return (
		<Suspense fallback={<QuizResultPageSkeleton />}>
			<QuizResultPageContent examId={examId} attemptId={attemptId} />
		</Suspense>
	);
}
