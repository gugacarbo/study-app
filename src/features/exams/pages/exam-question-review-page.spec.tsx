import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ExamQuestionReviewPageContent } from "@/features/exams/pages/exam-question-review-page";
import type { ExamDetail } from "@/features/exams/types/exam-detail";

const mockUseExam = vi.fn();
const mockUseQuestionImprovementDrafts = vi.fn();
const mockNavigate = vi.fn();
const resolveDraftMock = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock("@/features/exams/hooks/use-exam", () => ({
	useExam: (examId: string) => mockUseExam(examId),
	examQueryKey: (examId: string) => ["exams", examId],
}));

vi.mock("@/features/exams/hooks/use-question-improvement-drafts", () => ({
	useQuestionImprovementDrafts: (examId: string) =>
		mockUseQuestionImprovementDrafts(examId),
	questionImprovementDraftsQueryKey: (examId: string) => [
		"question-improvement-drafts",
		examId,
	],
}));

vi.mock("@/features/exams/hooks/use-question-improvement-draft-actions", () => ({
	useQuestionImprovementDraftActions: () => ({
		resolveDraft: {
			mutateAsync: resolveDraftMock,
			isPending: false,
			isError: false,
		},
	}),
}));

vi.mock("@/features/exams/hooks/use-update-question", () => ({
	useUpdateQuestion: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
	}),
}));

const examWithQuestions: ExamDetail = {
	id: "exam-1",
	name: "Prova de Matemática",
	createdAt: "2026-06-17T12:00:00.000Z",
	questionCount: 2,
	questions: [
		{
			id: "q1",
			question: "Quanto é 2 + 2?",
			options: [
				{ key: "A", text: "3" },
				{ key: "B", text: "4" },
			],
			answers: ["B"],
			topic: "Aritmética",
			scoringMode: "exact",
			explanation: null,
			deepExplanation: null,
		},
		{
			id: "q2",
			question: "Selecione os números primos.",
			options: [
				{ key: "A", text: "2" },
				{ key: "B", text: "4" },
				{ key: "C", text: "3" },
			],
			answers: ["A", "C"],
			topic: null,
			scoringMode: "partial",
			explanation: null,
			deepExplanation: null,
		},
	],
};

const draft: QuestionImprovementDraftRecord = {
	id: "draft-1",
	userId: "user-1",
	examId: "exam-1",
	questionId: "q2",
	jobId: "job-1",
	status: "pending_review",
	originalSnapshot: {
		question: "Selecione os números primos.",
		options: examWithQuestions.questions[1]!.options,
		answers: ["A", "C"],
		topic: null,
		scoringMode: "partial",
		explanation: null,
		deepExplanation: null,
	},
	improvedSnapshot: {
		question: "Marque todos os números primos.",
		options: [
			{ key: "A", text: "2" },
			{ key: "B", text: "5" },
			{ key: "C", text: "3" },
		],
		answers: ["A", "B", "C"],
		topic: "Números",
		scoringMode: "partial",
		explanation: "2, 3 e 5 são primos.",
		deepExplanation: "Um número primo tem exatamente dois divisores positivos.",
	},
	summary: "Tornei o enunciado mais direto.",
	metadata: null,
	createdAt: null,
	updatedAt: null,
};

describe("ExamQuestionReviewPageContent", () => {
	afterEach(() => {
		cleanup();
		mockUseExam.mockReset();
		mockUseQuestionImprovementDrafts.mockReset();
		mockNavigate.mockReset();
		resolveDraftMock.mockReset();
	});

	it("renders the edit form pre-filled with the AI suggestion when a draft exists", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		expect(
			screen.getByText(/revisão de melhoria por questão/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/^enunciado$/i)).toHaveValue(
			"Marque todos os números primos.",
		);
		expect(screen.getByDisplayValue("Números")).toBeInTheDocument();
		expect(screen.getByDisplayValue("2, 3 e 5 são primos.")).toBeInTheDocument();
		expect(
			screen.getByDisplayValue("Um número primo tem exatamente dois divisores positivos."),
		).toBeInTheDocument();
	});

	it("approves the draft with the edited snapshot when saving", async () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		fireEvent.change(screen.getByLabelText(/^enunciado$/i), {
			target: { value: "Enunciado revisado manualmente." },
		});

		fireEvent.click(screen.getByRole("button", { name: /aprovar/i }));

		await waitFor(() => {
			expect(resolveDraftMock).toHaveBeenCalledWith({
				action: "approve",
				draftId: "draft-1",
				finalSnapshot: expect.objectContaining({
					question: "Enunciado revisado manualmente.",
					topic: "Números",
				}),
			});
		});
	});

	it("discards the draft when the reject button is clicked", async () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		fireEvent.click(screen.getByRole("button", { name: /rejeitar melhoria/i }));

		await waitFor(() => {
			expect(resolveDraftMock).toHaveBeenCalledWith({
				action: "discard",
				draftId: "draft-1",
			});
		});
	});

	it("navigates to the next pending improvement after resolving a draft", async () => {
		const nextDraft = {
			...draft,
			id: "draft-2",
			questionId: "q1",
		};
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft, nextDraft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		fireEvent.click(screen.getByRole("button", { name: /rejeitar melhoria/i }));

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/exams/$examId/questions/$questionId/edit",
				params: { examId: "exam-1", questionId: "q1" },
			});
		});
	});

	it("navigates back to the question when there is no remaining draft after resolving", async () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		fireEvent.click(screen.getByRole("button", { name: /aprovar/i }));

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/exams/$examId/questions/$questionId",
				params: { examId: "exam-1", questionId: "q2" },
			});
		});
	});

	it("opens the next pending improvement from the header action", async () => {
		const nextDraft = {
			...draft,
			id: "draft-2",
			questionId: "q1",
		};
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft, nextDraft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		fireEvent.click(screen.getByRole("button", { name: /próxima melhoria/i }));

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith({
				to: "/exams/$examId/questions/$questionId/edit",
				params: { examId: "exam-1", questionId: "q1" },
			});
		});
	});

	it("disables the header next-improvement action when there is no remaining draft", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		expect(
			screen.getByRole("button", { name: /próxima melhoria/i }),
		).toBeDisabled();
	});

	it("waits for the improvement drafts before deciding the review is missing", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({
			data: undefined,
			isPending: true,
			isError: false,
			error: null,
		});

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		expect(
			screen.getByTestId("question-improvement-review-loading"),
		).toBeInTheDocument();
	});

	it("renders the dedicated edit route without the review header when there is no draft", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({
			data: [],
			isPending: false,
			isError: false,
			error: null,
		});

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q1" />);

		expect(screen.getByLabelText(/^enunciado$/i)).toBeInTheDocument();
		expect(
			screen.queryByText(/revisão de melhoria por questão/i),
		).not.toBeInTheDocument();
		expect(screen.queryByText(/voltar para a questão/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /rejeitar melhoria/i })).not.toBeInTheDocument();
	});
});
