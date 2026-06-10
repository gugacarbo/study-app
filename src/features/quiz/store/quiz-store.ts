import { Store } from "@tanstack/store";

export interface QuizState {
	currentQuestionIndex: number;
	selectedAnswers: string[];
	answers: Record<number, string>;
	score: number;
	total: number;
	isComplete: boolean;
	hasStarted: boolean;
	hasSavedProgress: boolean;
	showExplanation: boolean;
	explanation: string;
	isCorrect: boolean | null;
}

const initialState: QuizState = {
	currentQuestionIndex: 0,
	selectedAnswers: [],
	answers: {},
	score: 0,
	total: 0,
	isComplete: false,
	hasStarted: false,
	hasSavedProgress: false,
	showExplanation: false,
	explanation: "",
	isCorrect: null,
};

export const quizStore = new Store<QuizState>(initialState);

export function hydrateQuiz(state: QuizState) {
	quizStore.setState(() => state);
}

export function resetQuiz(totalQuestions: number) {
	quizStore.setState(() => ({
		...initialState,
		total: totalQuestions,
	}));
}

export function startQuiz() {
	quizStore.setState((s) => ({
		...s,
		hasStarted: true,
		hasSavedProgress: false,
	}));
}

export function selectAnswer(answer: string) {
	quizStore.setState((s) => ({ ...s, selectedAnswers: [answer] }));
}

export function toggleAnswer(answer: string) {
	quizStore.setState((s) => {
		const selected = s.selectedAnswers.includes(answer)
			? s.selectedAnswers.filter((item) => item !== answer)
			: [...s.selectedAnswers, answer];
		return { ...s, selectedAnswers: selected };
	});
}

export function nextQuestion() {
	quizStore.setState((s) => {
		const nextIndex = s.currentQuestionIndex + 1;
		return {
			...s,
			currentQuestionIndex: nextIndex,
			selectedAnswers: [],
			hasStarted: true,
			hasSavedProgress: false,
			showExplanation: false,
			isCorrect: null,
			isComplete: nextIndex >= s.total,
		};
	});
}

export function recordAnswer(
	credit: number,
	isFullyCorrect: boolean,
	explanation: string,
) {
	quizStore.setState((s) => ({
		...s,
		score: s.score + credit,
		showExplanation: true,
		explanation,
		isCorrect: isFullyCorrect,
		hasSavedProgress: false,
	}));
}
