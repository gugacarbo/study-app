import { Suspense, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizNavigation } from "@/features/quiz/components/quiz-navigation";
import { QuizQuestionCard } from "@/features/quiz/components/quiz-question-card";
import { useActiveAttempt } from "@/features/quiz/hooks/use-active-attempt";
import { useFinishAttempt } from "@/features/quiz/hooks/use-finish-attempt";
import { useSubmitAnswer } from "@/features/quiz/hooks/use-submit-answer";

export type QuizSessionPageProps = {
	examId: string;
	attemptId: string;
};

export function QuizSessionPage({ examId, attemptId }: QuizSessionPageProps) {
	return (
		<Suspense fallback={<QuizSessionSkeleton />}>
			<QuizSessionPageContent examId={examId} attemptId={attemptId} />
		</Suspense>
	);
}

function QuizSessionSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<Skeleton className="h-5 w-48" />
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-16 w-full" />
		</div>
	);
}

function QuizSessionPageContent({ examId, attemptId }: QuizSessionPageProps) {
	const navigate = useNavigate();
	const { data: session } = useActiveAttempt(examId);
	const submitAnswer = useSubmitAnswer(attemptId, examId);
	const finishAttempt = useFinishAttempt(attemptId, examId);
	const [currentIndex, setCurrentIndex] = useState(0);

	if (!session || session.attempt.id !== attemptId) {
		void navigate({ to: "/exams/$examId/quiz", params: { examId } });
		return null;
	}

	if (session.attempt.status === "completed") {
		void navigate({
			to: "/exams/$examId/quiz/$attemptId/result",
			params: { examId, attemptId },
		});
		return null;
	}

	const { attempt, questions } = session;
	const currentQuestion = questions[currentIndex];

	if (!currentQuestion) {
		return <p>Nenhuma questão disponível.</p>;
	}

	const selectedOptionIds = currentQuestion.selectedOptionIds;
	const isRevealed = currentQuestion.selectedOptionIds.length > 0;

	function handleToggleOption(optionId: string, checked: boolean) {
		const next = checked
			? [...selectedOptionIds, optionId]
			: selectedOptionIds.filter((id) => id !== optionId);
		submitAnswer.mutate({
			questionId: currentQuestion.id,
			selectedOptions: next,
		});
	}

	function handleSubmitAnswer() {
		if (selectedOptionIds.length === 0) return;
		submitAnswer.mutate({
			questionId: currentQuestion.id,
			selectedOptions: selectedOptionIds,
		});
	}

	function handlePrevious() {
		setCurrentIndex((index) => Math.max(0, index - 1));
	}

	function handleNext() {
		setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
	}

	function handleFinish() {
		finishAttempt.mutate(undefined, {
			onSuccess: () => {
				void navigate({
					to: "/exams/$examId/quiz/$attemptId/result",
					params: { examId, attemptId },
				});
			},
		});
	}

	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-xl font-semibold">Quiz</h1>
			<QuizQuestionCard
				question={currentQuestion}
				selectedOptionIds={selectedOptionIds}
				revealMode={attempt.config.revealMode}
				isRevealed={isRevealed}
				onToggleOption={handleToggleOption}
				onSubmitAnswer={handleSubmitAnswer}
				isSubmitting={submitAnswer.isPending}
			/>
			<QuizNavigation
				currentIndex={currentIndex}
				total={attempt.totalQuestions}
				canGoBack={currentIndex > 0}
				canGoForward={currentIndex < questions.length - 1}
				onPrevious={handlePrevious}
				onNext={handleNext}
				onFinish={handleFinish}
				isFinishing={finishAttempt.isPending}
			/>
		</div>
	);
}
