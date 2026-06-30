import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ExamQuestionItem } from "@/features/exams/components/exam-question-item";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

const singleAnswerQuestion: QuestionDetail = {
	id: "q1",
	question: "Qual é a capital da França?",
	options: [
		{ key: "A", text: "Londres" },
		{ key: "B", text: "Paris" },
		{ key: "C", text: "Madri" },
		{ key: "D", text: "Berlim" },
	],
	answers: ["B"],
	topicId: null,
	topic: "Geografia",
	scoringMode: "exact",
	explanation: null,
	deepExplanation: null,
};

const partialAnswerQuestion: QuestionDetail = {
	id: "q2",
	question: "Quais são cores primárias?",
	options: [
		{ key: "A", text: "Vermelho" },
		{ key: "B", text: "Verde" },
		{ key: "C", text: "Azul" },
		{ key: "D", text: "Amarelo" },
	],
	answers: ["A", "C"],
	topicId: null,
	topic: null,
	scoringMode: "partial",
	explanation: null,
	deepExplanation: null,
};

const pendingDraft: QuestionImprovementDraftRecord = {
	id: "draft-1",
	userId: "user-1",
	examId: "exam-1",
	questionId: "q1",
	jobId: "job-1",
	status: "pending_review",
	originalSnapshot: {
		question: singleAnswerQuestion.question,
		options: singleAnswerQuestion.options,
		answers: ["B"],
		topic: "Geografia",
		scoringMode: "exact",
		explanation: null,
		deepExplanation: null,
	},
	improvedSnapshot: {
		question: singleAnswerQuestion.question,
		options: singleAnswerQuestion.options,
		answers: ["B"],
		topic: "Geografia",
		scoringMode: "exact",
		explanation: null,
		deepExplanation: null,
	},
	summary: "Refinei o enunciado.",
	metadata: null,
	createdAt: null,
	updatedAt: null,
};

describe("ExamQuestionItem", () => {
	it("renders question text and options in lowercase", () => {
		render(<ExamQuestionItem index={1} question={singleAnswerQuestion} />);

		expect(screen.getByTestId("question-main-panel")).toBeInTheDocument();
		expect(screen.getByTestId("question-page-main")).toBeInTheDocument();
		expect(screen.getByText(/Q1 · Geografia/i)).toBeInTheDocument();
		expect(screen.getByText(/Londres/i)).toBeInTheDocument();
		expect(screen.getByText(/Paris/i)).toBeInTheDocument();
		expect(
			screen.getByRole("listitem", { name: /a\)/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("listitem", { name: /b\)/i }),
		).toBeInTheDocument();
	});

	it("shows null topic as Geral in trigger", () => {
		render(<ExamQuestionItem index={2} question={partialAnswerQuestion} />);

		expect(screen.getByText(/Q2 · Geral/i)).toBeInTheDocument();
		expect(screen.getByText(/Respostas múltiplas/i)).toBeInTheDocument();
		expect(screen.getByText(/4 alternativas/i)).toBeInTheDocument();
	});

	it("highlights correct answer inline without exposing a manual edit card", () => {
		render(<ExamQuestionItem index={1} question={singleAnswerQuestion} />);

		const correctItem = screen.getByRole("listitem", { name: /b\)/i });
		expect(within(correctItem).getByText(/Correta/i)).toBeInTheDocument();

		const wrongItem = screen.getByRole("listitem", { name: /a\)/i });
		expect(within(wrongItem).queryByText(/Correta/i)).not.toBeInTheDocument();

		expect(screen.queryByTestId("question-side-panel")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /editar pergunta/i }),
		).not.toBeInTheDocument();
	});

	it("highlights correct answers inline for partial scoring", () => {
		render(<ExamQuestionItem index={2} question={partialAnswerQuestion} />);

		expect(
			within(screen.getByRole("listitem", { name: /a\)/i })).getByText(
				/Correta/i,
			),
		).toBeInTheDocument();
		expect(
			within(screen.getByRole("listitem", { name: /c\)/i })).getByText(
				/Correta/i,
			),
		).toBeInTheDocument();
		expect(
			within(screen.getByRole("listitem", { name: /b\)/i })).queryByText(
				/Correta/i,
			),
		).not.toBeInTheDocument();
		expect(
			within(screen.getByRole("listitem", { name: /d\)/i })).queryByText(
				/Correta/i,
			),
		).not.toBeInTheDocument();
	});

	it("shows the pending-improvement badge when a draft is provided", () => {
		render(
			<ExamQuestionItem
				index={1}
				question={singleAnswerQuestion}
				draft={pendingDraft}
			/>,
		);

		expect(screen.getByText(/Melhoria pendente/i)).toBeInTheDocument();
	});

	it("does not show the pending-improvement badge when no draft is provided", () => {
		render(<ExamQuestionItem index={1} question={singleAnswerQuestion} />);

		expect(screen.queryByText(/Melhoria pendente/i)).not.toBeInTheDocument();
	});

	it("renders nothing interactive inside the question view", async () => {
		const user = userEvent.setup();
		render(
			<ExamQuestionItem
				index={1}
				question={singleAnswerQuestion}
				draft={pendingDraft}
			/>,
		);

		await user.tab();

		expect(
			screen.queryByRole("button", { name: /editar pergunta/i }),
		).not.toBeInTheDocument();
	});
});