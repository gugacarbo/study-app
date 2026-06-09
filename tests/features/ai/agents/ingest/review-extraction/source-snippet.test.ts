import { describe, expect, it } from "vitest";
import { extractQuestionSourceSnippet } from "@/features/ai/agents/ingest/review-extraction/source-snippet";
import { buildReviewerUserPrompt } from "@/features/ai/agents/ingest/review-extraction/prompt";

describe("extractQuestionSourceSnippet", () => {
	it("returns only the matching excerpt instead of the full source text", () => {
		const filler = `${"x\n\n".repeat(2_000)}`;
		const sourceText = `${filler}\nQuestao 12: O que e cache?\nA) Memoria rapida\nB) Disco\nResposta: A\n${filler}`;

		const snippet = extractQuestionSourceSnippet(sourceText, {
			question: "O que e cache?",
			options: ["Memoria rapida", "Disco"],
			answer: "A",
		});

		expect(snippet.length).toBeLessThan(5_000);
		expect(snippet).toContain("O que e cache?");
		expect(snippet).not.toContain("x".repeat(1000));
	});

	it("returns an empty string when the question cannot be located", () => {
		expect(
			extractQuestionSourceSnippet("Prova sem correspondencia", {
				question: "Outra questao",
				options: ["A", "B"],
				answer: "A",
			}),
		).toBe("");
	});
});

describe("buildReviewerUserPrompt", () => {
	it("does not include the full exam text or duplicated question JSON", () => {
		const sourceText = `${"intro\n\n".repeat(2_000)}Questao alvo: Derivada de x^2?\nA) 2x\nB) x\n${"outro\n\n".repeat(2_000)}`;

		const prompt = buildReviewerUserPrompt(
			sourceText,
			{
				question: "Derivada de x^2?",
				options: ["2x", "x"],
				answer: "2x",
				explanation: "",
				topic: "Calculo",
			},
			0,
		);

		expect(prompt.length).toBeLessThan(5_000);
		expect(prompt).toContain("Source excerpt for this question only:");
		expect(prompt).toContain("Derivada de x^2?");
		expect(prompt).not.toContain("intro intro intro");
		expect(prompt).not.toContain('"options":["2x","x"]');
	});
});
