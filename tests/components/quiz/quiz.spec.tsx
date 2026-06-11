import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Quiz } from "@/features/quiz/components/quiz";

const mockState = vi.hoisted(() => ({
	value: {
		currentQuestionIndex: 0,
		selectedAnswers: [],
		answers: {},
		score: 0,
		total: 2,
		isComplete: false,
		showExplanation: false,
		explanation: "",
		isCorrect: null,
		hasStarted: false,
		hasSavedProgress: false,
	},
}));

const mockUseQuizState = vi.hoisted(() => vi.fn());
const mockUseQuizPersistence = vi.hoisted(() => vi.fn());
const mockUseQuizKeyboard = vi.hoisted(() => vi.fn());
const mockStartQuiz = vi.hoisted(() => vi.fn());
const mockRestartQuiz = vi.hoisted(() => vi.fn());
const mockRestartAttempt = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-store", () => ({
	useSelector: () => mockState.value,
}));

vi.mock("@/features/quiz/components/quiz/use-quiz-state", () => ({
	useQuizState: mockUseQuizState,
	quizStore: {},
	nextQuestion: vi.fn(),
	selectAnswer: vi.fn(),
	toggleAnswer: vi.fn(),
	startQuiz: mockStartQuiz,
}));

vi.mock("@/features/quiz/components/use-quiz-persistence", () => ({
	useQuizPersistence: mockUseQuizPersistence,
}));

vi.mock("@/features/quiz/components/use-quiz-keyboard", () => ({
	useQuizKeyboard: mockUseQuizKeyboard,
}));

vi.mock("@/features/quiz/components/quiz-question", () => ({
	QuizQuestion: ({ question }: { question: { question: string } }) => (
		<div>Question: {question.question}</div>
	),
}));

vi.mock("@/features/quiz/components/quiz-results", () => ({
	QuizResults: () => <div>Results</div>,
}));

vi.mock("@/features/quiz/components/quiz-explanation", () => ({
	QuizExplanation: () => <div>Explanation</div>,
}));

vi.mock("@/features/quiz/components/quiz-loading", () => ({
	QuizLoading: ({ withButton }: { withButton?: boolean }) => (
		<div>{withButton ? "Loading with button" : "Loading"}</div>
	),
}));

vi.mock("@/components/ui/card", () => ({
	Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
	}: {
		children: ReactNode;
		onClick?: () => void;
	}) => <button onClick={onClick}>{children}</button>,
}));

afterEach(() => {
	cleanup();
});

beforeEach(() => {
	mockUseQuizState.mockReturnValue({
		questions: [
			{
				id: 1,
				question: "Pergunta 1",
				options: ["A", "B"],
				answers: ["A"],
				explanation: "Explicacao",
				topic: "Teste",
			},
			{
				id: 2,
				question: "Pergunta 2",
				options: ["C", "D"],
				answers: ["C"],
				explanation: "Explicacao",
				topic: "Teste",
			},
		],
		mut: { isPending: false, isError: false, error: null, mutate: vi.fn() },
		longExp: "",
		attempts: [],
		restartAttempt: mockRestartAttempt,
		ans: { current: [] },
		attemptId: null,
		setAttemptId: vi.fn(),
		attemptIdRef: { current: null },
	});
	mockUseQuizPersistence.mockReturnValue({
		init: true,
		restartQuiz: mockRestartQuiz,
	});
	mockUseQuizKeyboard.mockReturnValue(undefined);
	mockStartQuiz.mockReset();
	mockRestartQuiz.mockReset();
	mockRestartAttempt.mockReset();
	mockState.value = {
		currentQuestionIndex: 0,
		selectedAnswers: [],
		answers: {},
		score: 0,
		total: 2,
		isComplete: false,
		showExplanation: false,
		explanation: "",
		isCorrect: null,
		hasStarted: false,
		hasSavedProgress: false,
	};
});

describe("Quiz", () => {
	it("shows a start screen before the first question in a new quiz", () => {
		render(<Quiz examId={1} />);

		expect(screen.getByText("Pronto para começar?")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Começar quiz" })).toBeTruthy();
		expect(screen.queryByText("Question: Pergunta 1")).toBeNull();
	});

	it("starts the quiz when the user clicks the start button", () => {
		render(<Quiz examId={1} />);

		fireEvent.click(screen.getByRole("button", { name: "Começar quiz" }));

		expect(mockStartQuiz).toHaveBeenCalledTimes(1);
	});

	it("shows the start screen with a continue option when the quiz has saved progress", () => {
		mockState.value = {
			currentQuestionIndex: 1,
			selectedAnswers: [],
			answers: { 1: "A" },
			score: 1,
			total: 2,
			isComplete: false,
			showExplanation: false,
			explanation: "",
			isCorrect: null,
			hasStarted: false,
			hasSavedProgress: true,
		};

		render(<Quiz examId={1} />);

		expect(screen.getByText("Pronto para continuar?")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Continuar quiz" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Recomeçar" })).toBeTruthy();
		expect(screen.queryByText("Question: Pergunta 2")).toBeNull();
	});

	it("restarts the quiz when the user clicks restart on an unfinished attempt", async () => {
		mockState.value = {
			currentQuestionIndex: 1,
			selectedAnswers: [],
			answers: { 1: "A" },
			score: 1,
			total: 2,
			isComplete: false,
			showExplanation: false,
			explanation: "",
			isCorrect: null,
			hasStarted: false,
			hasSavedProgress: true,
		};

		render(<Quiz examId={1} />);

		fireEvent.click(screen.getByRole("button", { name: "Recomeçar" }));

		await waitFor(() => {
			expect(mockRestartAttempt).toHaveBeenCalledTimes(1);
			expect(mockRestartQuiz).toHaveBeenCalledTimes(1);
			expect(mockStartQuiz).toHaveBeenCalledTimes(1);
		});
	});

	it("shows a list of previous attempts on the start screen", () => {
		mockUseQuizState.mockReturnValue({
			questions: [
				{
					id: 1,
					question: "Pergunta 1",
					options: ["A", "B"],
					answers: ["A"],
					explanation: "Explicacao",
					topic: "Teste",
				},
			],
			mut: { isPending: false, isError: false, error: null, mutate: vi.fn() },
			longExp: "",
			attempts: [
				{
					id: 12,
					total_questions: 10,
					answered_questions: 10,
					correct_answers: 8,
					status: "completed",
					accuracy: 80,
					started_at: "2026-06-05 10:00:00",
				},
				{
					id: 11,
					total_questions: 10,
					answered_questions: 3,
					correct_answers: 2,
					status: "in_progress",
					accuracy: 67,
					started_at: "2026-06-05 09:00:00",
				},
			],
			restartAttempt: mockRestartAttempt,
			ans: { current: [] },
			attemptId: null,
			setAttemptId: vi.fn(),
			attemptIdRef: { current: null },
		});

		render(<Quiz examId={1} />);

		expect(screen.getByText("Tentativas anteriores")).toBeTruthy();
		expect(screen.getByText("Tentativa #12")).toBeTruthy();
		expect(screen.getByText("Tentativa #11")).toBeTruthy();
		expect(screen.getByText("8/10 acertos")).toBeTruthy();
		expect(screen.getByText("3/10 respondidas")).toBeTruthy();
	});

	it("shows restart when there is an unfinished attempt in the attempts list", () => {
		mockUseQuizState.mockReturnValue({
			questions: [
				{
					id: 1,
					question: "Pergunta 1",
					options: ["A", "B"],
					answers: ["A"],
					explanation: "Explicacao",
					topic: "Teste",
				},
			],
			mut: { isPending: false, isError: false, error: null, mutate: vi.fn() },
			longExp: "",
			attempts: [
				{
					id: 11,
					total_questions: 10,
					answered_questions: 3,
					correct_answers: 2,
					status: "in_progress",
					accuracy: 67,
					started_at: "2026-06-05 09:00:00",
				},
			],
			restartAttempt: mockRestartAttempt,
			ans: { current: [] },
			attemptId: null,
			setAttemptId: vi.fn(),
			attemptIdRef: { current: null },
		});
		mockState.value = {
			currentQuestionIndex: 0,
			selectedAnswers: [],
			answers: {},
			score: 0,
			total: 1,
			isComplete: false,
			showExplanation: false,
			explanation: "",
			isCorrect: null,
			hasStarted: false,
			hasSavedProgress: false,
		};

		render(<Quiz examId={1} />);

		expect(screen.getByRole("button", { name: "Recomeçar" })).toBeTruthy();
	});
});
