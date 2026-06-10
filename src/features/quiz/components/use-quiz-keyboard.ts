import { useCallback, useEffect } from "react";
import {
	nextQuestion,
	type QuizState,
	selectAnswer,
	toggleAnswer,
} from "@/features/quiz/store/quiz-store";
import type { Question } from "@/lib/validation";

interface QuizMutationRef {
	current:
		| {
				isPending: boolean;
				mutate: (v: {
					attemptId?: number | null;
					examId?: number;
					totalQuestions: number;
					questionId: number;
					userAnswers: string[];
					correctAnswers: string[];
					question: string;
					topic?: string;
				}) => void;
		  }
		| undefined;
}

interface UseQuizKeyboardArgs {
	questionsRef: React.MutableRefObject<Question[] | undefined>;
	stateRef: React.MutableRefObject<QuizState | undefined>;
	mutationRef: QuizMutationRef;
	attemptIdRef: React.MutableRefObject<number | null>;
	examId?: number;
	topic?: string;
}

export function useQuizKeyboard({
	questionsRef,
	stateRef,
	mutationRef,
	attemptIdRef,
	examId,
	topic,
}: UseQuizKeyboardArgs) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs always have latest values
	const handler = useCallback((e: KeyboardEvent) => {
		const qs = questionsRef.current;
		const state = stateRef.current;
		const m = mutationRef.current;
		if (!qs?.[state?.currentQuestionIndex ?? -1]) return;
		const q = qs[state?.currentQuestionIndex ?? 0];
		const isMultiAnswer = q.answers.length > 1;
		const num = Number(e.key) - 1;
		if (num >= 0 && num < q.options.length && q.options[num]) {
			if (isMultiAnswer) toggleAnswer(q.options[num]);
			else selectAnswer(q.options[num]);
		}
		if (e.key === "Enter") {
			if (m?.isPending) return;
			if (state?.selectedAnswers.length && !state?.showExplanation)
				m?.mutate({
					attemptId: attemptIdRef.current,
					examId,
					totalQuestions: state.total,
					questionId: (q as unknown as { id: number }).id,
					userAnswers: state.selectedAnswers,
					correctAnswers: q.answers,
					question: q.question,
					topic,
				});
			else if (state?.showExplanation) nextQuestion();
		}
	}, []);

	useEffect(() => {
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [handler]);
}
