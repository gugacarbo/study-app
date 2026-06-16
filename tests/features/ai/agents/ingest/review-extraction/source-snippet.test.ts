import { describe, expect, it } from "vitest";
import { extractQuestionSourceSnippet } from "@/features/ai/agents/ingest/review-extraction/source-snippet";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "@/features/ai/agents/ingest/review-extraction/prompt";

describe("extractQuestionSourceSnippet", () => {
	it("returns only the matching excerpt instead of the full source text", () => {
		const filler = `${"x\n\n".repeat(2_000)}`;
		const sourceText = `${filler}\nQuestao 12: O que e cache?\nA) Memoria rapida\nB) Disco\nResposta: A\n${filler}`;

		const snippet = extractQuestionSourceSnippet(sourceText, {
			question: "O que e cache?",
			options: ["Memoria rapida", "Disco"],
			answers: ["A"],
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
				answers: ["A"],
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
				answers: ["2x"],
				scoringMode: "exact",
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
		expect(prompt).toContain("Extracted question snapshot:");
		expect(prompt).toContain("Stem: Derivada de x^2?");
	});

	it("includes distinct question snapshots when the source excerpt is missing", () => {
		const sourceText = "Prova sem correspondencia";

		const promptA = buildReviewerUserPrompt(
			sourceText,
			{
				question: "Pergunta A?",
				options: ["1", "2"],
				answers: ["1"],
				scoringMode: "exact",
				explanation: "",
				topic: "Topico A",
			},
			0,
		);
		const promptB = buildReviewerUserPrompt(
			sourceText,
			{
				question: "Pergunta B totalmente diferente?",
				options: ["x", "y"],
				answers: ["x"],
				scoringMode: "exact",
				explanation: "",
				topic: "Topico B",
			},
			2,
		);

		expect(promptA).toContain('questionId "q1"');
		expect(promptB).toContain('questionId "q3"');
		expect(promptA).toContain("Stem: Pergunta A?");
		expect(promptB).toContain("Stem: Pergunta B totalmente diferente?");
		expect(promptA).not.toEqual(promptB);
	});

	it("uses the matching workspace questionId in the system prompt", () => {
		const systemPrompt = buildReviewerSystemPrompt(["Calculo"], "q3");

		expect(systemPrompt).toContain('questionId "q3"');
		expect(systemPrompt).not.toContain('questionId "q1"');
	});
});
