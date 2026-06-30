import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ExamQuestionPageContent } from "@/features/exams/pages/exam-question-page";
import type { ExamDetail } from "@/features/exams/types/exam-detail";

const mockUseExam = vi.fn();
const mockUseQuestionImprovementDrafts = vi.fn();
const mockNavigate = vi.fn();

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
}));

vi.mock("@/features/exams/hooks/use-update-question", () => ({
	useUpdateQuestion: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
	}),
}));

vi.mock("@/features/exams/hooks/use-question-improvement-draft-actions", () => ({
	useQuestionImprovementDraftActions: () => ({
		approveDraft: {
			mutateAsync: vi.fn(),
			isPending: false,
		},
		discardDraft: {
			mutateAsync: vi.fn(),
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
		options: examWithQuestions.questions[1]!.options,
		answers: ["A", "C"],
		topic: "Números",
		scoringMode: "partial",
		explanation: null,
		deepExplanation: null,
	},
	summary: "Tornei o enunciado mais direto.",
	metadata: null,
	createdAt: null,
	updatedAt: null,
};

describe("ExamQuestionPageContent", () => {
	afterEach(() => {
		cleanup();
		mockUseExam.mockReset();
		mockUseQuestionImprovementDrafts.mockReset();
		mockNavigate.mockReset();
	});

	it("renders full question detail with previous and next navigation state", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [] });

		render(<ExamQuestionPageContent examId="exam-1" questionId="q1" />);

		expect(screen.getByTestId("question-page-toolbar")).toBeInTheDocument();
		expect(screen.getByTestId("question-page-main")).toBeInTheDocument();
		expect(screen.getByTestId("question-page-sidebar")).toBeInTheDocument();
		expect(screen.getByText(/Q1 de 2/i)).toBeInTheDocument();
		expect(screen.getByText(/quanto é 2 \+ 2\?/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /editar pergunta/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /questão anterior/i }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /próxima questão/i }),
		).toBeEnabled();
	});

	it("falls back to Geral and shows draft state for the selected question", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [draft] });

		render(<ExamQuestionPageContent examId="exam-1" questionId="q2" />);

		expect(screen.getByText(/Q2 de 2/i)).toBeInTheDocument();
		expect(screen.getAllByText(/Q2 · Geral/i)).toHaveLength(3);
		expect(screen.getAllByText(/melhoria pendente/i).length).toBeGreaterThanOrEqual(2);
		expect(
			screen.getByRole("heading", { name: /decisão sobre a melhoria/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /enunciado/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/marque todos os números primos/i)).toBeInTheDocument();
		expect(screen.getAllByText(/Selecione os números primos./i).length).toBeGreaterThanOrEqual(1);
		expect(
			screen.getByTestId("question-improvement-section-metadata"),
		).toHaveTextContent(/números/i);
		expect(screen.queryByText(/^Original$/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/^Melhorada$/i)).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /aprovar melhoria/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /descartar melhoria/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /questão anterior/i }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: /próxima questão/i }),
		).toBeDisabled();
	});

	it("throws not found when the question does not belong to the exam", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [] });

		try {
			render(<ExamQuestionPageContent examId="exam-1" questionId="missing" />);
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(404);
			return;
		}

		throw new Error("Expected a 404 response");
	});
});
