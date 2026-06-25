import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamQuestionItem } from "@/features/exams/components/exam-question-item";
import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

const singleAnswerQuestion: QuestionDetail = {
	id: "q1",
	question: "Qual a capital do Brasil?",
	options: [
		{ key: "A", text: "São Paulo" },
		{ key: "B", text: "Brasília" },
		{ key: "C", text: "Rio de Janeiro" },
	],
	answers: ["B"],
	topic: "Geografia",
	scoringMode: "exact",
	explanation: null,
	deepExplanation: null,
};

const partialAnswerQuestion: QuestionDetail = {
	id: "q2",
	question: "Selecione os números primos:",
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
};

const updateQuestionMock = vi.fn();
const invalidateExamMock = vi.fn();
const approveDraftMock = vi.fn();
const discardDraftMock = vi.fn();

vi.mock("@/features/exams/hooks/use-update-question", () => ({
	useUpdateQuestion: () => ({
		mutateAsync: updateQuestionMock,
		isPending: false,
		isError: false,
	}),
}));

vi.mock("@/features/exams/hooks/use-question-improvement-draft-actions", () => ({
	useQuestionImprovementDraftActions: () => ({
		approveDraft: {
			mutateAsync: approveDraftMock,
			isPending: false,
		},
		discardDraft: {
			mutateAsync: discardDraftMock,
			isPending: false,
		},
	}),
}));

describe("ExamQuestionItem", () => {
	afterEach(() => {
		cleanup();
		updateQuestionMock.mockClear();
		invalidateExamMock.mockClear();
		approveDraftMock.mockClear();
		discardDraftMock.mockClear();
	});

	it("shows question text and options in lowercase", () => {
		render(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
			/>,
		);

		expect(screen.getByTestId("question-main-panel")).toBeInTheDocument();
		expect(screen.getByTestId("question-side-panel")).toBeInTheDocument();
		expect(screen.getByText("Qual a capital do Brasil?")).toBeInTheDocument();
		expect(screen.getAllByText(/Q1 · Geografia/i)).toHaveLength(2);

		const optionList = screen.getByTestId("question-options");
		const items = optionList.querySelectorAll("li");
		expect(items).toHaveLength(3);
		expect(items[0]?.textContent).toMatch(/a\)\s*São Paulo/);
		expect(items[1]?.textContent).toMatch(/b\)\s*Brasília/);
		expect(items[2]?.textContent).toMatch(/c\)\s*Rio de Janeiro/);
	});

	it("shows null topic as Geral in trigger", () => {
		render(
			<ExamQuestionItem
				index={2}
				examId="exam-1"
				question={partialAnswerQuestion}
			/>,
		);

		expect(screen.getAllByText(/Q2 · Geral/i)).toHaveLength(2);
	});

	it("highlights correct answer inline for single-answer question", () => {
		render(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
			/>,
		);

		const optionList = screen.getByTestId("question-options");
		const items = optionList.querySelectorAll("li");
		expect(items[1]?.className).toContain("bg-emerald-50");
		expect(items[0]?.className).not.toContain("bg-emerald-50");
	});

	it("highlights correct answers inline for partial-answer question", () => {
		render(
			<ExamQuestionItem
				index={2}
				examId="exam-1"
				question={partialAnswerQuestion}
			/>,
		);

		const optionList = screen.getByTestId("question-options");
		const items = optionList.querySelectorAll("li");
		expect(items[0]?.className).toContain("bg-emerald-50");
		expect(items[2]?.className).toContain("bg-emerald-50");
		expect(items[1]?.className).not.toContain("bg-emerald-50");
	});

	it("switches to edit form in the side panel while keeping question content visible", () => {
		render(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /editar pergunta/i }),
		);

		expect(screen.getByText("Qual a capital do Brasil?")).toBeInTheDocument();
		expect(screen.getByLabelText(/enunciado/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /cancelar/i }),
		).toBeInTheDocument();
	});

	it("shows pending improvement actions when a draft exists", async () => {
		const draft: QuestionImprovementDraftRecord = {
			id: "draft-1",
			userId: "user-1",
			examId: "exam-1",
			questionId: "q1",
			jobId: "job-1",
			status: "pending_review",
			originalSnapshot: {
				question: "Qual a capital do Brasil?",
				options: singleAnswerQuestion.options,
				answers: ["B"],
				topic: "Geografia",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Qual é a capital federal do Brasil?",
				options: [
					{ key: "A", text: "São Paulo" },
					{ key: "B", text: "Brasília" },
					{ key: "C", text: "Belo Horizonte" },
				],
				answers: ["B"],
				topic: "Geografia do Brasil",
				scoringMode: "exact",
				explanation: "Brasília é a capital.",
				deepExplanation: null,
			},
			summary: "Refinei os distratores.",
			metadata: null,
			createdAt: null,
			updatedAt: null,
		};

		render(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
				draft={draft}
			/>,
		);

		expect(screen.getAllByText(/melhoria pendente/i).length).toBeGreaterThanOrEqual(2);
		expect(screen.getByText(/qual é a capital federal do brasil/i)).toBeInTheDocument();
		expect(screen.getByText(/refinei os distratores/i)).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /aprovar melhoria/i }));
		expect(approveDraftMock).toHaveBeenCalledWith({ draftId: "draft-1" });

		fireEvent.click(screen.getByRole("button", { name: /descartar melhoria/i }));
		expect(discardDraftMock).toHaveBeenCalledWith({ draftId: "draft-1" });
	});
});
