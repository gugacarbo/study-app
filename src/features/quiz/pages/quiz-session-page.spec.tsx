import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizSessionPage } from "@/features/quiz/pages/quiz-session-page";
import type { ActiveAttempt } from "@/features/quiz/types/quiz";

const mockNavigate = vi.fn();
const mockUseActiveAttempt = vi.fn();
const mockSubmitMutate = vi.fn();
const mockSubmitMutateAsync = vi.fn();
const mockFinishMutate = vi.fn();

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock("@/features/quiz/hooks/use-active-attempt", () => ({
	useActiveAttempt: (...args: unknown[]) => mockUseActiveAttempt(...args),
}));

vi.mock("@/features/quiz/hooks/use-submit-answer", () => ({
	useSubmitAnswer: () => ({
		mutate: mockSubmitMutate,
		mutateAsync: mockSubmitMutateAsync,
		isPending: false,
	}),
}));

vi.mock("@/features/quiz/hooks/use-finish-attempt", () => ({
	useFinishAttempt: () => ({
		mutate: mockFinishMutate,
		isPending: false,
	}),
}));

function makeSession(
	overrides?: Partial<ActiveAttempt>,
): ActiveAttempt {
	return {
		attempt: {
			id: "attempt-1",
			examId: "exam-1",
			config: {
				order: "original",
				quantity: 1,
				topicFilter: null,
				revealMode: "during",
			},
			totalQuestions: 2,
			answeredQuestions: 0,
			correctAnswers: 0,
			status: "in_progress",
			startedAt: "2026-06-24T12:00:00.000Z",
		},
		questions: [
			{
				id: "question-1",
				question: "Qual alternativa está correta?",
				options: [
					{ id: "A", text: "Primeira" },
					{ id: "B", text: "Segunda" },
				],
				correctOptionIds: ["B"],
				selectedOptionIds: [],
				scoringMode: "exact",
				topic: "Teste",
				explanation: "A alternativa correta é a segunda.",
			},
			{
				id: "question-2",
				question: "Segunda pergunta",
				options: [
					{ id: "A", text: "Terceira" },
					{ id: "B", text: "Quarta" },
				],
				correctOptionIds: ["A"],
				selectedOptionIds: [],
				scoringMode: "exact",
				topic: "Teste",
				explanation: "A terceira alternativa é a correta.",
			},
		],
		...overrides,
	};
}

describe("QuizSessionPage", () => {
	afterEach(() => {
		cleanup();
		mockNavigate.mockReset();
		mockUseActiveAttempt.mockReset();
		mockSubmitMutate.mockReset();
		mockSubmitMutateAsync.mockReset();
		mockFinishMutate.mockReset();
	});

	it("only submits and reveals the answer after explicit confirmation in during mode", () => {
		mockUseActiveAttempt.mockReturnValue({
			data: makeSession(),
		});

		render(<QuizSessionPage examId="exam-1" attemptId="attempt-1" />);

		fireEvent.click(screen.getByLabelText(/alternativa a/i));

		expect(mockSubmitMutate).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: /confirmar resposta/i }),
		).toBeInTheDocument();
		expect(screen.queryByText(/resposta incorreta/i)).not.toBeInTheDocument();
		expect(
			screen.queryByText(/a alternativa correta é a segunda/i),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /confirmar resposta/i }));

		expect(mockSubmitMutate).toHaveBeenCalledWith(
			{
				questionId: "question-1",
				selectedOptions: ["A"],
			},
			expect.objectContaining({
				onSuccess: expect.any(Function),
			}),
		);
	});

	it("navigates to the final summary after finishing the attempt", () => {
		mockUseActiveAttempt.mockReturnValue({
			data: makeSession(),
		});

		render(<QuizSessionPage examId="exam-1" attemptId="attempt-1" />);

		fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

		expect(mockFinishMutate).toHaveBeenCalledWith(
			undefined,
			expect.objectContaining({
				onSuccess: expect.any(Function),
			}),
		);

		const [, options] = mockFinishMutate.mock.calls[0] ?? [];
		options?.onSuccess?.();

		expect(mockNavigate).toHaveBeenCalledWith({
			to: "/exams/$examId/quiz/$attemptId/result",
			params: { examId: "exam-1", attemptId: "attempt-1" },
		});
	});

	it("does not redirect back to quiz config while finishing and the active attempt disappears", () => {
		let session: ActiveAttempt | null = makeSession();

		mockUseActiveAttempt.mockImplementation(() => ({
			data: session,
		}));

		mockFinishMutate.mockImplementation((_value, _options) => {
			session = null;
		});

		const { rerender } = render(
			<QuizSessionPage examId="exam-1" attemptId="attempt-1" />,
		);

		fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));
		rerender(<QuizSessionPage examId="exam-1" attemptId="attempt-1" />);

		expect(mockNavigate).not.toHaveBeenCalledWith({
			to: "/exams/$examId/quiz",
			params: { examId: "exam-1" },
		});
	});

	it("persists the current draft answer before finishing the attempt", () => {
		mockSubmitMutateAsync.mockResolvedValue(undefined);
		mockUseActiveAttempt.mockReturnValue({
			data: makeSession(),
		});

		render(<QuizSessionPage examId="exam-1" attemptId="attempt-1" />);

		fireEvent.click(screen.getByLabelText(/alternativa a/i));
		fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

		return Promise.resolve().then(() => {
			expect(mockSubmitMutateAsync).toHaveBeenCalledWith({
				questionId: "question-1",
				selectedOptions: ["A"],
			});
			expect(mockFinishMutate).toHaveBeenCalled();
		});
	});

	it("supports keyboard and mouse shortcuts for answering and navigation", async () => {
		let session = makeSession();

		mockUseActiveAttempt.mockImplementation(() => ({
			data: session,
		}));

		mockSubmitMutate.mockImplementation((payload, options) => {
			session = {
				...session,
				questions: session.questions.map((question) =>
					question.id === payload.questionId
						? { ...question, selectedOptionIds: payload.selectedOptions }
						: question,
				),
			};
			options?.onSuccess?.();
		});

		const { rerender } = render(
			<QuizSessionPage examId="exam-1" attemptId="attempt-1" />,
		);

		fireEvent.keyDown(window, { key: "2", code: "Digit2" });
		expect(screen.getByLabelText(/alternativa b/i)).toHaveAttribute(
			"data-state",
			"checked",
		);

		fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
		expect(mockSubmitMutate).toHaveBeenCalledWith(
			{
				questionId: "question-1",
				selectedOptions: ["B"],
			},
			expect.objectContaining({
				onSuccess: expect.any(Function),
			}),
		);

		rerender(<QuizSessionPage examId="exam-1" attemptId="attempt-1" />);

		fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
		expect(screen.getByText(/segunda pergunta/i)).toBeInTheDocument();

		fireEvent.wheel(screen.getByRole("radiogroup", { name: /alternativas/i }), {
			deltaY: 100,
		});
		expect(screen.getByLabelText(/alternativa b/i)).toHaveAttribute(
			"data-state",
			"checked",
		);

		fireEvent.keyDown(window, { key: "Numpad1", code: "Numpad1" });
		expect(screen.getByLabelText(/alternativa a/i)).toHaveAttribute(
			"data-state",
			"checked",
		);

		fireEvent.keyDown(window, { key: "Backspace", code: "Backspace" });
		await waitFor(() => {
			expect(screen.getByText(/qual alternativa está correta/i)).toBeInTheDocument();
		});
	});
});
