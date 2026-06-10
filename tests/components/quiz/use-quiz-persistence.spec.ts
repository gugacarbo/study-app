import { describe, expect, it } from "vitest";
import { normalizeHydratedQuizState } from "@/features/quiz/components/use-quiz-persistence";

describe("normalizeHydratedQuizState", () => {
	it("keeps a fresh saved session on the intro screen", () => {
		const state = normalizeHydratedQuizState(
			{
				currentQuestionIndex: 0,
				selectedAnswers: [],
				answers: {},
				score: 0,
				total: 10,
				isComplete: false,
				showExplanation: false,
				explanation: "",
				isCorrect: null,
			},
			10,
		);

		expect(state.hasStarted).toBe(false);
		expect(state.hasSavedProgress).toBe(false);
	});

	it("keeps legacy sessions with progress on the intro screen and enables continue", () => {
		const state = normalizeHydratedQuizState(
			{
				currentQuestionIndex: 2,
				selectedAnswers: [],
				answers: { 1: "A" },
				score: 1,
				total: 10,
				isComplete: false,
				showExplanation: false,
				explanation: "",
				isCorrect: null,
			},
			10,
		);

		expect(state.hasStarted).toBe(false);
		expect(state.hasSavedProgress).toBe(true);
	});

	it("keeps current-schema incomplete sessions on the intro screen with continue enabled", () => {
		const state = normalizeHydratedQuizState(
			{
				currentQuestionIndex: 0,
				selectedAnswers: [],
				answers: {},
				score: 0,
				total: 10,
				isComplete: false,
				hasStarted: true,
				hasSavedProgress: false,
				showExplanation: false,
				explanation: "",
				isCorrect: null,
			},
			10,
		);

		expect(state.hasStarted).toBe(false);
		expect(state.hasSavedProgress).toBe(true);
	});
});
