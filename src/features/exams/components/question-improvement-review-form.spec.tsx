import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionImprovementReviewForm } from "@/features/exams/components/question-improvement-review-form";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

vi.mock("@/functions/exams/search-question-topics", () => ({
	searchQuestionTopics: vi.fn(),
}));

vi.mock("@/functions/exams/create-question-topic", () => ({
	createQuestionTopicServerFn: vi.fn(),
}));

const currentQuestion: QuestionDetail = {
	id: "q1",
	question: "Qual alternativa apresenta um número primo?",
	options: [
		{ key: "A", text: "4" },
		{ key: "B", text: "5" },
		{ key: "C", text: "6" },
	],
	answers: ["B"],
	topicId: "topic-1",
	topic: "Aritmética",
	scoringMode: "exact",
	explanation: "5 é o único número primo entre as alternativas.",
	deepExplanation: "Números primos possuem exatamente dois divisores positivos.",
};

const suggestedQuestion: QuestionDetail = {
	...currentQuestion,
	question: "Marque a alternativa que contém um número primo.",
	topicId: "topic-2",
	topic: "Números primos",
	explanation: "A alternativa correta é 5.",
	deepExplanation:
		"5 é divisível apenas por 1 e por ele mesmo, então é primo.",
};

describe("QuestionImprovementReviewForm", () => {
	afterEach(() => {
		cleanup();
	});

	it("stacks all review sections in a single vertical column", () => {
		render(
			<QuestionImprovementReviewForm
				currentQuestion={currentQuestion}
				suggestedQuestion={suggestedQuestion}
				onApprove={vi.fn()}
				onDiscard={vi.fn()}
			/>,
		);

		const layout = screen.getByTestId("question-improvement-review-layout");
		expect(
			within(layout).queryByTestId("question-improvement-review-side-column"),
		).not.toBeInTheDocument();
		expect(
			within(layout).getByTestId("question-improvement-review-stem-section"),
		).toBeInTheDocument();
		expect(
			within(layout).getByTestId("question-improvement-review-metadata-section"),
		).toBeInTheDocument();
		expect(
			within(layout).getByTestId("question-improvement-review-options-section"),
		).toBeInTheDocument();
		expect(
			within(layout).getByTestId("question-improvement-review-explanation-section"),
		).toBeInTheDocument();
		const deepExplanationSection = within(layout).getByTestId(
			"question-improvement-review-deep-explanation-section",
		);
		expect(
			within(deepExplanationSection).getByRole("button", { name: /atual/i }),
		).toBeInTheDocument();
		expect(
			within(deepExplanationSection).getByLabelText(/explicação detalhada/i),
		).toBeInTheDocument();
	});

	it("shows the current and generated versions inside each review section", () => {
		render(
			<QuestionImprovementReviewForm
				currentQuestion={currentQuestion}
				suggestedQuestion={suggestedQuestion}
				onApprove={vi.fn()}
				onDiscard={vi.fn()}
			/>,
		);

		const stemSection = screen.getByTestId(
			"question-improvement-review-stem-section",
		);

		expect(within(stemSection).getByText(/^versão atual$/i)).toBeInTheDocument();
		expect(within(stemSection).getByText(/^versão gerada$/i)).toBeInTheDocument();
		expect(
			within(stemSection).getByText(currentQuestion.question),
		).toBeInTheDocument();
		expect(
			within(stemSection).getByText(suggestedQuestion.question),
		).toBeInTheDocument();
	});

	it("shows the standard field editing UI when a section has no improvement changes", () => {
		render(
			<QuestionImprovementReviewForm
				currentQuestion={currentQuestion}
				suggestedQuestion={{
					...suggestedQuestion,
					question: currentQuestion.question,
				}}
				onApprove={vi.fn()}
				onDiscard={vi.fn()}
			/>,
		);

		const stemSection = screen.getByTestId(
			"question-improvement-review-stem-section",
		);

		expect(
			within(stemSection).queryByText(/^versão gerada$/i),
		).not.toBeInTheDocument();
		expect(
			within(stemSection).queryByText(/^versão atual$/i),
		).not.toBeInTheDocument();
		expect(
			within(stemSection).queryByText(/^merge$/i),
		).not.toBeInTheDocument();
		expect(
			within(stemSection).queryByRole("button", { name: /^atual$/i }),
		).not.toBeInTheDocument();
		expect(
			within(stemSection).queryByRole("button", { name: /^ia$/i }),
		).not.toBeInTheDocument();
		expect(
			within(stemSection).queryByText(/sem mudança sugerida pela ia/i),
		).not.toBeInTheDocument();
		expect(
			within(stemSection).getByLabelText(/enunciado/i),
		).toBeInTheDocument();
	});
});
