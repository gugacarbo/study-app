import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useQuizKeyboard } from "@/features/quiz/components/use-quiz-keyboard";
import type { QuizState } from "@/features/quiz/store/quiz-store";
import type { Question } from "@/lib/validation";

const { mockSelectAnswer } = vi.hoisted(() => ({
	mockSelectAnswer: vi.fn(),
}));

vi.mock("@/features/quiz/store/quiz-store", async () => {
	const actual = await vi.importActual<
		typeof import("@/features/quiz/store/quiz-store")
	>("@/features/quiz/store/quiz-store");

	return {
		...actual,
		nextQuestion: vi.fn(),
		selectAnswer: mockSelectAnswer,
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

describe("useQuizKeyboard", () => {
	it("selects the fifth answer when key 5 is pressed", () => {
		mockSelectAnswer.mockReset();

		render(
			<KeyboardHarness
				questions={[
					{
						question: "Qual alternativa esta correta?",
						options: ["a", "b", "c", "d", "e"],
						answer: "e",
						explanation: "",
						topic: "Teste",
					},
				]}
				state={{
					currentQuestionIndex: 0,
					selectedAnswer: null,
					answers: {},
					score: 0,
					total: 1,
					isComplete: false,
					showExplanation: false,
					explanation: "",
					isCorrect: null,
				}}
			/>,
		);

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "5" }));

		expect(mockSelectAnswer).toHaveBeenCalledWith("e");
	});
});
