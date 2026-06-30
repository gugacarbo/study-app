import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
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
		},
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

	it("starts the final version from the AI suggestion and lets the reviewer restore the current field", async () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		expect(
			screen.getByText(/revisão de melhoria por questão/i),
		).toBeInTheDocument();
		const stemSection = screen.getByTestId(
			"question-improvement-review-stem-section",
		);
		const textarea = within(stemSection).getByLabelText(/^enunciado$/i);
		expect(textarea).toHaveValue("Marque todos os números primos.");

		fireEvent.click(
			within(stemSection).getByRole("button", { name: /atual/i }),
		);
		expect(textarea).toHaveValue("Selecione os números primos.");

		fireEvent.click(screen.getByRole("button", { name: /aprovar versão final/i }));

		await waitFor(() => {
			expect(resolveDraftMock).toHaveBeenCalledWith({
				action: "approve",
				draftId: "draft-1",
				finalSnapshot: expect.objectContaining({
					question: "Selecione os números primos.",
				}),
			});
		});
	});

	it("renders a single merge context panel instead of repeating the review intro", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		expect(
			screen.queryByRole("heading", { name: /bancada de merge/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/use a sugestão da ia como ponto de partida/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/tornei o enunciado mais direto\./i),
		).not.toBeInTheDocument();
	});

	it("keeps the header compact by folding the next-step hint into the main card", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		expect(
			screen.queryByText(/depois desta decisão/i),
		).not.toBeInTheDocument();
		expect(screen.getByText(/próxima melhoria/i)).toBeInTheDocument();
	});

	it("discards the draft and sends the reviewer to the next pending improvement", async () => {
		const nextDraft = {
			...draft,
			id: "draft-2",
			questionId: "q1",
		};
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft, nextDraft] });

		render(<ExamQuestionReviewPageContent examId="exam-1" questionId="q2" />);

		fireEvent.click(screen.getByRole("button", { name: /rejeitar melhoria/i }));

		expect(resolveDraftMock).toHaveBeenCalledWith({
			action: "discard",
			draftId: "draft-1",
		});
	});

	it("navigates to the dedicated edit path for the next pending improvement", async () => {
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
});
