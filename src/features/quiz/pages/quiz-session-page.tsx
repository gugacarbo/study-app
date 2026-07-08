import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { QuizLoading } from "@/features/quiz/components/quiz-loading";
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
	return <QuizLoading />;
}

function QuizSessionPageContent({ examId, attemptId }: QuizSessionPageProps) {
	const navigate = useNavigate();
	const { data: session } = useActiveAttempt(examId);
	const submitAnswer = useSubmitAnswer(attemptId, examId);
	const finishAttempt = useFinishAttempt(attemptId, examId);
	const [currentIndex, setCurrentIndex] = useState(() => {
		const qs = session?.questions ?? [];
		const firstUnanswered = qs.findIndex(
			(q) => (q.selectedOptionIds ?? []).length === 0,
		);
		return firstUnanswered >= 0 ? firstUnanswered : 0;
	});
	const [isFinishingTransition, setIsFinishingTransition] = useState(false);
	const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
	const [draftSelections, setDraftSelections] = useState<Record<string, string[]>>(
		{},
	);
	const attempt = session?.attempt ?? null;
	const questions = session?.questions ?? [];
	const currentQuestion = questions[currentIndex] ?? null;
	const selectedOptionIds = currentQuestion
		? (draftSelections[currentQuestion.id] ?? currentQuestion.selectedOptionIds)
		: [];
	const isRevealed = currentQuestion
		? currentQuestion.selectedOptionIds.length > 0
		: false;
	const currentOptionIds = currentQuestion?.options.map((option) => option.id) ?? [];
	const isMultipleChoice = currentQuestion
		? currentQuestion.correctOptionIds.length > 1
		: false;

	useEffect(() => {
		if (!currentQuestion) {
			setActiveOptionId(null);
			return;
		}

		const firstSelectedOptionId = selectedOptionIds[0];
		if (
			firstSelectedOptionId &&
			currentOptionIds.includes(firstSelectedOptionId)
		) {
			setActiveOptionId(firstSelectedOptionId);
			return;
		}

		setActiveOptionId(currentOptionIds[0] ?? null);
	}, [currentQuestion, currentOptionIds, selectedOptionIds]);

	function setCurrentSelection(nextSelection: string[]) {
		if (!currentQuestion) return;

		setDraftSelections((current) => ({
			...current,
			[currentQuestion.id]: nextSelection,
		}));
	}

	function handleToggleOption(optionId: string, checked: boolean) {
		if (!currentQuestion) return;

		const next = isMultipleChoice
			? checked
				? [...selectedOptionIds.filter((id) => id !== optionId), optionId]
				: selectedOptionIds.filter((id) => id !== optionId)
			: checked
				? [optionId]
				: [];
		setActiveOptionId(optionId);
		setCurrentSelection(next);
	}

	function handleSubmitAnswer() {
		if (!currentQuestion) return;
		if (selectedOptionIds.length === 0) return;
		submitAnswer.mutate(
			{
				questionId: currentQuestion.id,
				selectedOptions: selectedOptionIds,
			},
			{
				onSuccess: () => {
					setDraftSelections((current) => {
						const next = { ...current };
						delete next[currentQuestion.id];
						return next;
					});
				},
			},
		);
	}

	function handlePrevious() {
		setCurrentIndex((index) => Math.max(0, index - 1));
	}

	function handleNext() {
		setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
	}

	function handleSelectOptionByIndex(optionIndex: number) {
		if (!currentQuestion || !attempt) return;

		const optionId = currentOptionIds[optionIndex];
		if (!optionId || (isRevealed && attempt.config.revealMode === "during")) {
			return;
		}

		setActiveOptionId(optionId);
		if (isMultipleChoice) {
			const checked = !selectedOptionIds.includes(optionId);
			handleToggleOption(optionId, checked);
			return;
		}

		setCurrentSelection([optionId]);
	}

	function handleCycleOptions(direction: "up" | "down") {
		if (!currentQuestion || !attempt) return;
		if (currentOptionIds.length === 0) return;
		if (isRevealed && attempt.config.revealMode === "during") return;

		const currentActiveIndex = activeOptionId
			? currentOptionIds.indexOf(activeOptionId)
			: -1;
		const fallbackIndex = selectedOptionIds[0]
			? currentOptionIds.indexOf(selectedOptionIds[0])
			: 0;
		const baseIndex = currentActiveIndex >= 0 ? currentActiveIndex : fallbackIndex;
		const delta = direction === "down" ? 1 : -1;
		const nextIndex =
			(baseIndex + delta + currentOptionIds.length) % currentOptionIds.length;
		const nextOptionId = currentOptionIds[nextIndex];

		setActiveOptionId(nextOptionId);
		if (!isMultipleChoice) {
			setCurrentSelection([nextOptionId]);
		}
	}

	useEffect(() => {
		if (!attempt || !currentQuestion) {
			return;
		}

		const revealMode = attempt.config.revealMode;

		function isEditableTarget(target: EventTarget | null) {
			if (!(target instanceof HTMLElement)) return false;
			if (target.isContentEditable) return true;
			return Boolean(
				target.closest(
					"input, textarea, select, button, [contenteditable='true']",
				),
			);
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			if (isEditableTarget(event.target)) {
				return;
			}

			const optionIndex = getOptionIndexFromKeyboardEvent(event);
			if (optionIndex != null) {
				event.preventDefault();
				handleSelectOptionByIndex(optionIndex);
				return;
			}

			if (event.key === "Enter") {
				event.preventDefault();
				if (revealMode === "during" && !isRevealed) {
					handleSubmitAnswer();
					return;
				}
				if (currentIndex < questions.length - 1) {
					handleNext();
				}
				return;
			}

			if (event.key === "Backspace") {
				if (currentIndex === 0) return;
				event.preventDefault();
				handlePrevious();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		attempt,
		currentIndex,
		handleNext,
		handlePrevious,
		handleSubmitAnswer,
		isRevealed,
		questions.length,
	]);

	if (!session) {
		if (isFinishingTransition) {
			return null;
		}

		void navigate({ to: "/exams/$examId/quiz", params: { examId } });
		return null;
	}

	if (session.attempt.id !== attemptId) {
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

	if (!currentQuestion) {
		return <p>Nenhuma questão disponível.</p>;
	}

	const activeAttempt = session.attempt;

	async function handleFinish() {
		setIsFinishingTransition(true);

		try {
			const pendingEntries = Object.entries(draftSelections).filter(
				([, optionIds]) => optionIds.length > 0,
			);

			for (const [questionId, optionIds] of pendingEntries) {
				await submitAnswer.mutateAsync({
					questionId,
					selectedOptions: optionIds,
				});
			}

			setDraftSelections({});
			finishAttempt.mutate(undefined, {
				onSuccess: () => {
					void navigate({
						to: "/exams/$examId/quiz/$attemptId/result",
						params: { examId, attemptId },
					});
				},
				onError: () => {
					setIsFinishingTransition(false);
				},
			});
		} catch {
			setIsFinishingTransition(false);
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<h1 className="font-serif text-xl font-medium tracking-tight text-foreground">Quiz</h1>
			<QuizQuestionCard
				question={currentQuestion}
				currentIndex={currentIndex}
				total={activeAttempt.totalQuestions}
				score={activeAttempt.correctAnswers}
				selectedOptionIds={selectedOptionIds}
				activeOptionId={activeOptionId}
				revealMode={activeAttempt.config.revealMode}
				isRevealed={isRevealed}
				onToggleOption={handleToggleOption}
				onCycleOptions={handleCycleOptions}
				onSubmitAnswer={handleSubmitAnswer}
				onNext={handleNext}
				isSubmitting={submitAnswer.isPending}
			/>
			<QuizNavigation
				currentIndex={currentIndex}
				total={activeAttempt.totalQuestions}
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

function getOptionIndexFromKeyboardEvent(
	event: KeyboardEvent,
): number | null {
	const codeMatch = event.code.match(/^(Digit|Numpad)([1-9])$/);
	if (codeMatch) {
		return Number(codeMatch[2]) - 1;
	}

	const keyMatch = event.key.match(/^[1-9]$/);
	if (keyMatch) {
		return Number(keyMatch[0]) - 1;
	}

	return null;
}
