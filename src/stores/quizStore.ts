import { Store } from '@tanstack/store';

export interface QuizState {
  currentQuestionIndex: number;
  selectedAnswer: string | null;
  answers: Record<number, string>;
  score: number;
  total: number;
  isComplete: boolean;
  showExplanation: boolean;
  explanation: string;
  isCorrect: boolean | null;
}

const initialState: QuizState = {
  currentQuestionIndex: 0,
  selectedAnswer: null,
  answers: {},
  score: 0,
  total: 0,
  isComplete: false,
  showExplanation: false,
  explanation: '',
  isCorrect: null,
};

export const quizStore = new Store<QuizState>(initialState);

export function resetQuiz(totalQuestions: number) {
  quizStore.setState(() => ({
    ...initialState,
    total: totalQuestions,
  }));
}

export function selectAnswer(answer: string) {
  quizStore.setState(s => ({ ...s, selectedAnswer: answer }));
}

export function nextQuestion() {
  quizStore.setState(s => {
    const nextIndex = s.currentQuestionIndex + 1;
    return {
      ...s,
      currentQuestionIndex: nextIndex,
      selectedAnswer: null,
      showExplanation: false,
      isCorrect: null,
      isComplete: nextIndex >= s.total,
    };
  });
}

export function recordAnswer(isCorrect: boolean, explanation: string) {
  quizStore.setState(s => ({
    ...s,
    score: isCorrect ? s.score + 1 : s.score,
    showExplanation: true,
    explanation,
    isCorrect,
  }));
}
