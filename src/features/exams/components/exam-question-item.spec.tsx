import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
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
};

describe("ExamQuestionItem", () => {
	afterEach(() => cleanup());

	function renderWithAccordion(ui: ReactElement) {
		return render(<Accordion type="multiple">{ui}</Accordion>);
	}

	it("expands to show question text and options", () => {
		renderWithAccordion(
			<ExamQuestionItem index={1} question={singleAnswerQuestion} />,
		);

		expect(
			screen.queryByText("Qual a capital do Brasil?"),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Geografia/i }));

		expect(screen.getByText("Qual a capital do Brasil?")).toBeInTheDocument();
		expect(screen.getByText(/São Paulo/)).toBeInTheDocument();
		expect(screen.getByText(/Brasília/)).toBeInTheDocument();
	});

	it("shows null topic as Geral in trigger", () => {
		renderWithAccordion(
			<ExamQuestionItem index={2} question={partialAnswerQuestion} />,
		);

		expect(
			screen.getByRole("button", { name: /Q2 · Geral/i }),
		).toBeInTheDocument();
	});

	it("reveals single-answer gabarito on demand", () => {
		renderWithAccordion(
			<ExamQuestionItem index={1} question={singleAnswerQuestion} />,
		);

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Geografia/i }));
		fireEvent.click(
			screen.getByRole("button", { name: /revelar resposta/i }),
		);

		expect(screen.getByText("Gabarito")).toBeInTheDocument();
		expect(screen.getByText("B) Brasília")).toBeInTheDocument();
		expect(screen.queryByText("A) São Paulo")).not.toBeInTheDocument();
	});

	it("reveals partial gabarito with multiple correct options", () => {
		renderWithAccordion(
			<ExamQuestionItem index={2} question={partialAnswerQuestion} />,
		);

		fireEvent.click(screen.getByRole("button", { name: /Q2 · Geral/i }));
		fireEvent.click(
			screen.getByRole("button", { name: /revelar resposta/i }),
		);

		expect(screen.getByText("A) 2")).toBeInTheDocument();
		expect(screen.getByText("C) 3")).toBeInTheDocument();
		expect(screen.queryByText("B) 4")).not.toBeInTheDocument();
	});
});
