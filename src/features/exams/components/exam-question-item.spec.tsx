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
		const { container } = render(
			<ExamQuestionItem index={1} question={singleAnswerQuestion} />,
		);

		expect(screen.getByTestId("question-main-panel")).toBeInTheDocument();
		expect(screen.getByTestId("question-page-main")).toBeInTheDocument();
		expect(within(container).getByText(/Q1 · Geografia/i)).toBeInTheDocument();
		expect(within(container).getByText(/Londres/i)).toBeInTheDocument();
		expect(within(container).getByText(/Paris/i)).toBeInTheDocument();
		expect(within(container).getAllByRole("listitem")).toHaveLength(4);
	});

	it("shows null topic as Geral in trigger", () => {
		const { container } = render(
			<ExamQuestionItem index={2} question={partialAnswerQuestion} />,
		);

		expect(within(container).getByText(/Q2 · Geral/i)).toBeInTheDocument();
		expect(within(container).getByText(/Respostas múltiplas/i)).toBeInTheDocument();
		expect(within(container).getByText(/4 alternativas/i)).toBeInTheDocument();
	});

	it("highlights correct answer inline without exposing a manual edit card", () => {
		const { container } = render(
			<ExamQuestionItem index={1} question={singleAnswerQuestion} />,
		);

		const items = within(container).getAllByRole("listitem");
		expect(within(items[1]).getByText(/Correta/i)).toBeInTheDocument();
		expect(within(items[0]).queryByText(/Correta/i)).not.toBeInTheDocument();

		expect(screen.queryByTestId("question-side-panel")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /editar pergunta/i }),
		).not.toBeInTheDocument();
	});

	it("highlights correct answers inline for partial scoring", () => {
		const { container } = render(
			<ExamQuestionItem index={2} question={partialAnswerQuestion} />,
		);

		const items = within(container).getAllByRole("listitem");
		expect(within(items[0]).getByText(/Correta/i)).toBeInTheDocument();
		expect(within(items[2]).getByText(/Correta/i)).toBeInTheDocument();
		expect(within(items[1]).queryByText(/Correta/i)).not.toBeInTheDocument();
		expect(within(items[3]).queryByText(/Correta/i)).not.toBeInTheDocument();
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