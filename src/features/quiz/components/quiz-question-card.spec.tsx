import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizQuestionCard } from "@/features/quiz/components/quiz-question-card";
import type { QuestionInAttempt } from "@/features/quiz/types/quiz";

const answeredQuestion: QuestionInAttempt = {
	id: "question-1",
	question: "Qual alternativa está correta?",
	options: [
		{ id: "A", text: "Primeira alternativa" },
		{ id: "B", text: "Segunda alternativa" },
	],
	correctOptionIds: ["B"],
	selectedOptionIds: ["A"],
	scoringMode: "exact",
	topic: "Teste",
	explanation: "A segunda alternativa resolve o enunciado.",
	deepExplanation:
		"A explicação longa compara cada alternativa e detalha o raciocínio.",
};

describe("QuizQuestionCard", () => {
	it("shows the short explanation below the answered question and keeps the long explanation in an accordion", () => {
		render(
			<QuizQuestionCard
				activeOptionId="A"
				currentIndex={0}
				isRevealed={true}
				onCycleOptions={vi.fn()}
				onSubmitAnswer={vi.fn()}
				onToggleOption={vi.fn()}
				question={answeredQuestion}
				revealMode="during"
				score={0}
				selectedOptionIds={["A"]}
				total={1}
			/>,
		);

		expect(screen.getByText(/resposta incorreta/i)).toBeInTheDocument();

		const explanation = screen.getByRole("region", {
			name: /explicação da questão/i,
		});
		expect(explanation).toHaveTextContent(
			"A segunda alternativa resolve o enunciado.",
		);

		expect(
			screen.queryByText(/a explicação longa compara cada alternativa/i),
		).not.toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("button", { name: /ver explicação completa/i }),
		);

		expect(
			screen.getByText(/a explicação longa compara cada alternativa/i),
		).toBeVisible();
	});
});
