import { describe, expect, it } from "vitest";
import {
	canonicalizeReviewQuestion,
	sanitizeReviewText,
} from "@/features/ai/jobs/ingest/run-ingest/review-question";

describe("sanitizeReviewText", () => {
	it("removes leading question and option markers", () => {
		expect(sanitizeReviewText("  1. Qual é a capital?  ")).toBe(
			"Qual é a capital?",
		);
		expect(sanitizeReviewText("Q2) Questão revisada")).toBe(
			"Questão revisada",
		);
		expect(sanitizeReviewText("b. alternativa revisada")).toBe(
			"alternativa revisada",
		);
		expect(sanitizeReviewText("• item revisado")).toBe("item revisado");
	});
});

describe("canonicalizeReviewQuestion", () => {
	it("reindexes option keys and remaps answers after reordering", () => {
		const result = canonicalizeReviewQuestion({
			question: "Questão revisada?",
			options: [
				{ key: "B", text: "b. Segunda" },
				{ key: "A", text: "A) Primeira" },
			],
			answers: ["B"],
			topic: "Geografia",
		});

		expect(result).toEqual({
			question: "Questão revisada?",
			options: [
				{ key: "A", text: "Segunda" },
				{ key: "B", text: "Primeira" },
			],
			answers: ["A"],
			topic: "Geografia",
		});
	});
});
