import { useEffect, useState } from "react";
import type { Question } from "../../lib/validation";
import { saveQuizSessionToMemory } from "../../server-functions/memory";
import {
	hydrateQuiz,
	quizStore,
	resetQuiz,
} from "../../stores/quizStore";

export interface QA {
	question: string
	userAnswer: string
	correctAnswer: string
	isCorrect: boolean
	explanation: string
	topic: string
}

export function useQuizPersistence({
	examId,
	topic,
	questions,
	answersRef,
}: {
	examId?: number
	topic?: string
	questions: Question[] | undefined
	answersRef: React.MutableRefObject<QA[]>
}) {
	const [init, setInit] = useState(false)
	const sk = `study-app:quiz:${examId ?? "topic"}:${topic ?? "general"}`

	useEffect(() => {
		if (!questions?.length || init) return
		const fb = () => {
			resetQuiz(questions.length)
			answersRef.current = []
			setInit(true)
		}
		try {
			const r = localStorage.getItem(sk)
			if (!r) {
				fb()
				return
			}
			const p = JSON.parse(r)
			if (
				!p?.quizState ||
				p.quizState.total !== questions.length ||
				p.quizState.currentQuestionIndex < 0 ||
				p.quizState.currentQuestionIndex > questions.length
			) {
				fb()
				return
			}
			hydrateQuiz(p.quizState)
			answersRef.current = Array.isArray(p.answers) ? p.answers : []
			setInit(true)
		} catch {
			fb()
		}
	}, [questions, init, sk, answersRef])

	useEffect(() => {
		if (!init) return
		const sub = quizStore.subscribe(() => {
			const s = quizStore.state
			localStorage.setItem(
				sk,
				JSON.stringify({ quizState: s, answers: answersRef.current }),
			)
			if (
				s.isComplete &&
				s.currentQuestionIndex >= s.total &&
				answersRef.current.length > 0
			) {
				saveQuizSessionToMemory({
					data: {
						examName: examId ? `Exam #${examId}` : topic || "General",
						topic: topic || "General",
						totalQuestions: s.total,
						correctAnswers: s.score,
						questions: answersRef.current,
					},
				}).catch(() => {})
				localStorage.removeItem(sk)
			}
		})
		return () => sub.unsubscribe()
	}, [init, sk, examId, topic, answersRef])

	return { init }
}
