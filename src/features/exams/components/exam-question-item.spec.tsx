import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Accordion } from "@/components/ui/accordion";
import { ExamQuestionItem } from "@/features/exams/components/exam-question-item";
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

vi.mock("@/features/exams/hooks/use-update-question", () => ({
	useUpdateQuestion: () => ({
		mutate: updateQuestionMock,
		isPending: false,
	}),
}));

describe("ExamQuestionItem", () => {
	afterEach(() => {
		cleanup();
		updateQuestionMock.mockClear();
		invalidateExamMock.mockClear();
	});

	function renderWithAccordion(ui: ReactElement) {
		return render(<Accordion type="multiple">{ui}</Accordion>);
	}

	it("expands to show question text and options in lowercase", () => {
		renderWithAccordion(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
			/>,
		);

		expect(
			screen.queryByText("Qual a capital do Brasil?"),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Geografia/i }));

		expect(screen.getByText("Qual a capital do Brasil?")).toBeInTheDocument();

		const optionList = screen.getByTestId("question-options");
		const items = optionList.querySelectorAll("li");
		expect(items).toHaveLength(3);
		expect(items[0]?.textContent).toMatch(/a\)\s*São Paulo/);
		expect(items[1]?.textContent).toMatch(/b\)\s*Brasília/);
		expect(items[2]?.textContent).toMatch(/c\)\s*Rio de Janeiro/);
	});

	it("shows null topic as Geral in trigger", () => {
		renderWithAccordion(
			<ExamQuestionItem
				index={2}
				examId="exam-1"
				question={partialAnswerQuestion}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /Q2 · Geral/i }),
		).toBeInTheDocument();
	});

	it("highlights correct answer inline for single-answer question", () => {
		renderWithAccordion(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Geografia/i }));

		const optionList = screen.getByTestId("question-options");
		const items = optionList.querySelectorAll("li");
		expect(items[1]?.className).toContain("bg-primary/10");
		expect(items[0]?.className).not.toContain("bg-primary/10");
	});

	it("highlights correct answers inline for partial-answer question", () => {
		renderWithAccordion(
			<ExamQuestionItem
				index={2}
				examId="exam-1"
				question={partialAnswerQuestion}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Q2 · Geral/i }));

		const optionList = screen.getByTestId("question-options");
		const items = optionList.querySelectorAll("li");
		expect(items[0]?.className).toContain("bg-primary/10");
		expect(items[2]?.className).toContain("bg-primary/10");
		expect(items[1]?.className).not.toContain("bg-primary/10");
	});

	it("switches to edit form when Edit button is clicked", () => {
		renderWithAccordion(
			<ExamQuestionItem
				index={1}
				examId="exam-1"
				question={singleAnswerQuestion}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Geografia/i }));
		fireEvent.click(
			screen.getByRole("button", { name: /editar pergunta/i }),
		);

		expect(screen.getByLabelText(/enunciado/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /cancelar/i }),
		).toBeInTheDocument();
	});
});