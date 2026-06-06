import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizResults } from "@/features/quiz/components/quiz-results";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		...props
	}: {
		children: ReactNode;
		[key: string]: unknown;
	}) => <a {...props}>{children}</a>,
}));

afterEach(() => {
	cleanup();
});

describe("QuizResults", () => {
	it("renders a button to go back to exams on the final summary", () => {
		render(<QuizResults score={1} total={1} answers={[]} />);

		const link = screen.getByText("Voltar para exames").closest("a");

		expect(link).toBeTruthy();
		if (!link) throw new Error("Expected exams link to exist");
		expect(link.getAttribute("to")).toBe("/exams");
	});

	it("toggles between short and full explanation when long explanation exists", () => {
		render(
			<QuizResults
				score={0}
				total={1}
				answers={[
					{
						question: "Pergunta",
						userAnswer: "Resposta errada",
						correctAnswer: "Resposta certa",
						isCorrect: false,
						explanation: "Explicacao curta",
						longExplanation: "Explicacao completa detalhada",
						topic: "Teste",
					},
				]}
			/>,
		);

		fireEvent.click(screen.getAllByText("Revisar questões erradas (1)")[0]);

		expect(screen.getByText("Explicacao curta")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Ver explicação completa" }));

		expect(screen.getByText("Explicacao completa detalhada")).toBeTruthy();
		expect(screen.queryByText("Explicacao curta")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Ver explicação curta" }));

		expect(screen.getByText("Explicacao curta")).toBeTruthy();
	});

	it("does not render the toggle button when there is no full explanation", () => {
		render(
			<QuizResults
				score={0}
				total={1}
				answers={[
					{
						question: "Pergunta",
						userAnswer: "Resposta errada",
						correctAnswer: "Resposta certa",
						isCorrect: false,
						explanation: "Explicacao curta",
						topic: "Teste",
					},
				]}
			/>,
		);

		fireEvent.click(screen.getAllByText("Revisar questões erradas (1)")[0]);

		expect(
			screen.queryByRole("button", { name: "Ver explicação completa" }),
		).toBeNull();
	});
});
