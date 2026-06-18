import { describe, expect, it } from "vitest";
import { normalizeQuestionText } from "@/features/ai/jobs/ingest/normalize-question";

describe("normalizeQuestionText", () => {
	it("trims, collapses whitespace, and lowercases", () => {
		expect(normalizeQuestionText("  Qual   é   a   Capital?  ")).toBe(
			"qual é a capital?",
		);
	});

	it("treats equivalent spacing as the same key", () => {
		expect(normalizeQuestionText("Questão\n\tum")).toBe(
			normalizeQuestionText("Questão um"),
		);
	});
});
