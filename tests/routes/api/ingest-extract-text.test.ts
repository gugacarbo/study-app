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
});

describe("buildExtractionUserPrompt", () => {
	it("includes the expected question count when available", () => {
		const prompt = buildExtractionUserPrompt("1. Questao unica", {
			fileName: "single-question.md",
			examName: "single question",
			expectedQuestionCount: 1,
		});

		expect(prompt).toContain(
			"The source appears to contain 1 question. Register each distinct question exactly once, then stop.",
		);
	});
});
