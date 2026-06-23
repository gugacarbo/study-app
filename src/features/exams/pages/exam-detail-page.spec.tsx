import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamDetailPageContent } from "@/features/exams/pages/exam-detail-page";
import type { ExamDetail } from "@/features/exams/types/exam-detail";

const mockUseExam = vi.fn();
const mockUseQuestionImprovementDrafts = vi.fn();

vi.mock("@/features/exams/hooks/use-exam", () => ({
	useExam: (examId: string) => mockUseExam(examId),
	examQueryKey: (examId: string) => ["exams", examId],
}));

vi.mock("@/features/exams/hooks/use-ingest-job-by-exam", () => ({
	useIngestJobByExam: () => ({ data: null }),
}));

vi.mock("@/features/exams/hooks/use-update-question", () => ({
	useUpdateQuestion: () => ({
		mutate: vi.fn(),
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
	}),
}));

vi.mock("@/features/exams/hooks/use-question-improvement-drafts", () => ({
	useQuestionImprovementDrafts: (examId: string) =>
		mockUseQuestionImprovementDrafts(examId),
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

vi.mock("@/features/exams/hooks/use-improve-questions-job", () => ({
	useImproveQuestionsJob: () => ({
		submit: vi.fn(),
		isPending: false,
		error: null,
	}),
}));

vi.mock("@/features/quiz/hooks/use-active-attempt", () => ({
	useActiveAttempt: () => ({ data: null }),
	activeAttemptQueryKey: (examId: string) => ["quiz", "active-attempt", examId],
}));

vi.mock("@/features/quiz/hooks/use-start-attempt", () => ({
	useStartAttempt: () => ({
		mutate: vi.fn(),
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
	}),
}));

const examWithQuestions: ExamDetail = {
	id: "11111111-1111-4111-8111-111111111111",
	name: "Prova de Matemática",
	createdAt: "2026-06-17T12:00:00.000Z",
	questionCount: 1,
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
	],
};

const emptyExam: ExamDetail = {
	id: "22222222-2222-4222-8222-222222222222",
	name: "Prova vazia",
	createdAt: null,
	questionCount: 0,
	questions: [],
};

describe("ExamDetailPageContent", () => {
	afterEach(() => {
		cleanup();
		mockUseExam.mockReset();
		mockUseQuestionImprovementDrafts.mockReset();
	});

	it("renders header, disabled CTAs, and question list", () => {
		mockUseExam.mockReturnValue({ data: examWithQuestions });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [] });

		render(
			<ExamDetailPageContent examId="11111111-1111-4111-8111-111111111111" />,
		);

		expect(screen.getByRole("heading", { name: /prova de matemática/i })).toBeInTheDocument();
		expect(screen.getByText(/1 questão/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /fazer quiz/i })).toBeEnabled();
		expect(screen.getByRole("button", { name: /melhorar/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Q1 · Aritmética/i }),
		).toBeInTheDocument();
	});

	it("shows empty state when exam has no questions", () => {
		mockUseExam.mockReturnValue({ data: emptyExam });
		mockUseQuestionImprovementDrafts.mockReturnValue({ data: [] });

		render(
			<ExamDetailPageContent examId="22222222-2222-4222-8222-222222222222" />,
		);

		expect(
			screen.getByText(/nenhuma questão disponível nesta prova/i),
		).toBeInTheDocument();
		expect(screen.getByText(/sem questões/i)).toBeInTheDocument();
	});
});
