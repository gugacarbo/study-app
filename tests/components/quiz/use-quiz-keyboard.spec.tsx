import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuizKeyboard } from "@/features/quiz/components/use-quiz-keyboard";
import type { QuizState } from "@/features/quiz/store/quiz-store";
import type { Question } from "@/lib/validation";

const { mockSelectAnswer, mockToggleAnswer } = vi.hoisted(() => ({
	mockSelectAnswer: vi.fn(),
	mockToggleAnswer: vi.fn(),
}));

vi.mock("@/features/quiz/store/quiz-store", async () => {
	const actual = await vi.importActual<
		typeof import("@/features/quiz/store/quiz-store")
	>("@/features/quiz/store/quiz-store");

	return {
		...actual,
		nextQuestion: vi.fn(),
		selectAnswer: mockSelectAnswer,
		toggleAnswer: mockToggleAnswer,
	};
});

function KeyboardHarness({
	questions,
	state,
}: {
	questions: Question[];
	state: QuizState;
}) {
	const questionsRef = useRef(questions);
	const stateRef = useRef(state);
	const mutationRef = useRef(undefined);
	const attemptIdRef = useRef<number | null>(null);

	useQuizKeyboard({
		questionsRef,
		stateRef,
		mutationRef,
		attemptIdRef,
	});

	return null;
}

afterEach(() => {
	cleanup();
});

const baseState: QuizState = {
	currentQuestionIndex: 0,
	selectedAnswers: [],
	answers: {},
	score: 0,
	total: 1,
	isComplete: false,
	hasStarted: true,
	hasSavedProgress: false,
	showExplanation: false,
	explanation: "",
	isCorrect: null,
};

describe("useQuizKeyboard", () => {
	it("selects the fifth answer when key 5 is pressed on single-answer questions", () => {
		mockSelectAnswer.mockReset();
		mockToggleAnswer.mockReset();

		render(
			<KeyboardHarness
				questions={[
					{
						question: "Qual alternativa esta correta?",
						options: ["a", "b", "c", "d", "e"],
						answers: ["e"],
						scoringMode: "exact",
						explanation: "",
						topic: "Teste",
					},
				]}
				state={baseState}
			/>,
		);

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "5" }));

		expect(mockSelectAnswer).toHaveBeenCalledWith("e");
		expect(mockToggleAnswer).not.toHaveBeenCalled();
	});

	it("toggles the third answer when key 3 is pressed on multi-answer questions", () => {
		mockSelectAnswer.mockReset();
		mockToggleAnswer.mockReset();

		render(
			<KeyboardHarness
				questions={[
					{
						question: "Quais alternativas estao corretas?",
						options: ["a", "b", "c"],
						answers: ["a", "c"],
						scoringMode: "exact",
						explanation: "",
						topic: "Teste",
					},
				]}
				state={baseState}
			/>,
		);

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));

		expect(mockToggleAnswer).toHaveBeenCalledWith("c");
		expect(mockSelectAnswer).not.toHaveBeenCalled();
	});
});
