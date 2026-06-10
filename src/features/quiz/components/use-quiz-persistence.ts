import { useEffect, useState } from "react";
import {
	hydrateQuiz,
	type QuizState,
	quizStore,
	resetQuiz,
} from "@/features/quiz/store/quiz-store";
import type { Question } from "@/lib/validation";
import { saveQuizSessionToMemory } from "@/server-functions/memory";

export interface QA {
	question: string;
	userAnswer: string;
	correctAnswers: string[];
	isCorrect: boolean;
	credit: number;
	explanation: string;
	longExplanation?: string;
	topic: string;
}

type SavedQuizState = Omit<QuizState, "hasStarted" | "hasSavedProgress"> &
	Partial<Pick<QuizState, "hasStarted" | "hasSavedProgress">> & {
		selectedAnswer?: string | null;
	};

function hasAnswerSelection(state: SavedQuizState): boolean {
	if (state.selectedAnswers.length > 0) return true;
	return Boolean(state.selectedAnswer);
}

function normalizeSelectedAnswers(state: SavedQuizState): string[] {
	if (state.selectedAnswers.length > 0) return state.selectedAnswers;
	if (state.selectedAnswer) return [state.selectedAnswer];
	return [];
}

export function normalizeHydratedQuizState(
	state: SavedQuizState,
	totalQuestions: number,
): QuizState {
	const selectedAnswers = normalizeSelectedAnswers(state);
	const baseState = {
		...state,
		selectedAnswers,
	};

	if (typeof state.hasStarted === "boolean") {
		const hasProgress =
			state.currentQuestionIndex > 0 ||
			Object.keys(state.answers).length > 0 ||
			state.score > 0 ||
			state.showExplanation ||
			state.isComplete ||
			hasAnswerSelection(state);
		const hasSavedAttempt =
			state.hasStarted || state.hasSavedProgress || hasProgress;

		return {
			...baseState,
			total: totalQuestions,
			hasStarted: state.isComplete ? state.hasStarted : false,
			hasSavedProgress: state.isComplete ? false : hasSavedAttempt,
		};
	}

	const hasProgress =
		state.currentQuestionIndex > 0 ||
		Object.keys(state.answers).length > 0 ||
		state.score > 0 ||
		state.showExplanation ||
		state.isComplete ||
		hasAnswerSelection(state);

	return {
		...baseState,
		total: totalQuestions,
		hasStarted: false,
		hasSavedProgress: hasProgress,
	};
}

export function useQuizPersistence({
	examId,
	topic,
	questions,
	answersRef,
	attemptId,
	setAttemptId,
}: {
	examId?: number;
	topic?: string;
	questions: Question[] | undefined;
	answersRef: React.MutableRefObject<QA[]>;
	attemptId: number | null;
	setAttemptId: React.Dispatch<React.SetStateAction<number | null>>;
}) {
	const [init, setInit] = useState(false);
	const sk = `study-app:quiz:${examId ?? "topic"}:${topic ?? "general"}`;
	const restartQuiz = () => {
		if (!questions?.length) return;
		localStorage.removeItem(sk);
		resetQuiz(questions.length);
		answersRef.current = [];
		setAttemptId(null);
	};

	useEffect(() => {
		if (!questions?.length || init) return;
		const fb = () => {
			resetQuiz(questions.length);
			answersRef.current = [];
			setAttemptId(null);
			setInit(true);
		};
		try {
			const r = localStorage.getItem(sk);
			if (!r) {
				fb();
				return;
			}
			const p = JSON.parse(r);
			if (
				!p?.quizState ||
				p.quizState.total !== questions.length ||
				p.quizState.currentQuestionIndex < 0 ||
				p.quizState.currentQuestionIndex > questions.length
			) {
				fb();
				return;
			}
			hydrateQuiz(normalizeHydratedQuizState(p.quizState, questions.length));
			answersRef.current = Array.isArray(p.answers) ? p.answers : [];
			setAttemptId(typeof p.attemptId === "number" ? p.attemptId : null);
			setInit(true);
		} catch {
			fb();
		}
	}, [questions, init, sk, answersRef, setAttemptId]);

	useEffect(() => {
		if (!init) return;
		const sub = quizStore.subscribe(() => {
			const s = quizStore.state;
			localStorage.setItem(
				sk,
				JSON.stringify({
					quizState: s,
					answers: answersRef.current,
					attemptId,
				}),
			);
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
				}).catch(() => {});
				setAttemptId(null);
				localStorage.removeItem(sk);
			}
		});
		return () => sub.unsubscribe();
	}, [init, sk, examId, topic, answersRef, attemptId, setAttemptId]);

	return { init, restartQuiz };
}
