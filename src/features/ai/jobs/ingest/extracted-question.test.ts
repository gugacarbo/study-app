import { describe, expect, it } from "vitest";
import {
	deriveScoringMode,
	parseExtractedQuestion,
	parseExtractedQuestionsRoot,
} from "@/features/ai/jobs/ingest/extracted-question";

const validQuestion = {
	question: "Qual é a capital do Brasil?",
	options: [
		{ key: "A", text: "São Paulo" },
		{ key: "B", text: "Brasília" },
	],
	answers: ["B"],
	topic: "Geografia",
};

describe("extracted-question", () => {
	it("accepts a valid question", () => {
		const result = parseExtractedQuestion(validQuestion);
		expect(result.ok).toBe(true);
	});

	it("rejects duplicate option keys", () => {
		const result = parseExtractedQuestion({
			...validQuestion,
			options: [
				{ key: "A", text: "Um" },
				{ key: "A", text: "Dois" },
			],
		});
		expect(result.ok).toBe(false);
	});

	it("rejects answer keys missing from options", () => {
		const result = parseExtractedQuestion({
			...validQuestion,
			answers: ["C"],
		});
		expect(result.ok).toBe(false);
	});

	it("rejects non A-Z option keys", () => {
		const result = parseExtractedQuestion({
			...validQuestion,
			options: [
				{ key: "1", text: "Um" },
				{ key: "B", text: "Dois" },
			],
		});
		expect(result.ok).toBe(false);
	});

	it("derives scoring_mode from answer count", () => {
		expect(deriveScoringMode(["A"])).toBe("exact");
		expect(deriveScoringMode(["A", "B"])).toBe("partial");
	});

	it("parses root object with questions array", () => {
		const result = parseExtractedQuestionsRoot({ questions: [validQuestion] });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.questions).toHaveLength(1);
		}
	});
});
