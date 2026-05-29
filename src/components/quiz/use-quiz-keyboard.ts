import { useCallback, useEffect } from "react";
import type { Question } from "../../lib/validation";
import {
	type QuizState,
	nextQuestion,
	selectAnswer,
} from "../../stores/quizStore";

interface QuizMutationRef {
	current:
		| {
				isPending: boolean
				mutate: (v: {
					questionId: number
					userAnswer: string
					correctAnswer: string
					question: string
					topic?: string
				}) => void
		  }
		| undefined
}

interface UseQuizKeyboardArgs {
	questionsRef: React.MutableRefObject<Question[] | undefined>
	stateRef: React.MutableRefObject<QuizState | undefined>
	mutationRef: QuizMutationRef
}

export function useQuizKeyboard({
	questionsRef,
	stateRef,
	mutationRef,
}: UseQuizKeyboardArgs) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs always have latest values
	const handler = useCallback((e: KeyboardEvent) => {
		const qs = questionsRef.current
		const state = stateRef.current
		const m = mutationRef.current
		if (!qs?.[state?.currentQuestionIndex ?? -1]) return
		const q = qs[state?.currentQuestionIndex ?? 0]
		const num = Number(e.key) - 1
		if (num >= 0 && num < 4 && q.options[num]) selectAnswer(q.options[num])
		if (e.key === "Enter") {
			if (m?.isPending) return
			if (state?.selectedAnswer && !state?.showExplanation)
				m?.mutate({
					questionId: (q as unknown as { id: number }).id,
					userAnswer: state.selectedAnswer,
					correctAnswer: q.answer,
					question: q.question,
					topic: q.topic,
				})
			else if (state?.showExplanation) nextQuestion()
		}
	}, [])

	useEffect(() => {
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [handler])
}
