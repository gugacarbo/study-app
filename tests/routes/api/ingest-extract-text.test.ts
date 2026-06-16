import { describe, expect, it } from "vitest";
import {
	buildExtractionUserPrompt,
	estimateSourceQuestionCount,
} from "@/routes/api/ingest/-extract-text";

describe("estimateSourceQuestionCount", () => {
	it("counts a single numbered question", () => {
		expect(
			estimateSourceQuestionCount(
				"1. Qual é a derivada de f(x) = x²?\na) 1\nb) 2x",
			),
		).toBe(1);
	});

	it("counts multiple numbered questions", () => {
		expect(
			estimateSourceQuestionCount(
				"1. Primeira questao\n2. Segunda questao\n3) Terceira questao",
			),
		).toBe(3);
	});

	it("counts markdown bold numbered questions without counting paragraph blocks", () => {
		const text = `# Arvores Binarias

## Questoes

**7. Uma arvore binaria e um caso especial de arvore em que:**
A) Todo no possui grau maior que dois.
B) Nenhum no possui grau maior que dois.

**8. Em uma arvore binaria, as estruturas T1 e T2 associadas a raiz representam:**
A) Pai e avo da raiz.
B) Subarvore esquerda e subarvore direita.

## Gabarito

7-B, 8-B`;

		expect(estimateSourceQuestionCount(text)).toBe(2);
	});

	it("falls back to gabarito entries when question stems are not numbered", () => {
		expect(
			estimateSourceQuestionCount(
				"Questao sobre cache\n\n## Gabarito\n\n1-A, 2-B, 3-C",
			),
		).toBe(3);
	});

	it("returns undefined for multi-block text without numbered questions", () => {
		expect(
			estimateSourceQuestionCount(
				"# Titulo\n\nParagrafo um.\n\nParagrafo dois.\n\n## Outra secao",
			),
		).toBeUndefined();
	});
});

describe("buildExtractionUserPrompt", () => {
	it("includes the expected question count when available", () => {
		const prompt = buildExtractionUserPrompt("1. Questao unica", {
			fileName: "single-question.md",
			examName: "single question",
			expectedQuestionCount: 1,
		});

		expect(prompt).toContain(
			"The source appears to contain about 1 numbered question. Register each distinct question exactly once, then stop.",
		);
	});
});
