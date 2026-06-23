import { describe, expect, it } from "vitest";
import type { QuestionRow } from "@/db/queries/questions";
import { parseQuestionRow } from "@/features/exams/lib/parse-question-fields";

function makeRow(overrides: Partial<QuestionRow> = {}): QuestionRow {
	return {
		id: "00000000-0000-4000-8000-000000000001",
		examId: "00000000-0000-4000-8000-000000000002",
		question: "Sample question?",
		options: JSON.stringify([
			{ key: "A", text: "First" },
			{ key: "B", text: "Second" },
		]),
		answers: JSON.stringify(["A"]),
		scoringMode: "exact",
		explanation: null,
		deepExplanation: null,
		topic: "Topic",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("parseQuestionRow", () => {
	it("parses valid options and answers", () => {
		const row = makeRow();

		expect(parseQuestionRow(row)).toEqual({
			id: row.id,
			question: row.question,
			options: [
				{ key: "A", text: "First" },
				{ key: "B", text: "Second" },
			],
			answers: ["A"],
			topic: "Topic",
			scoringMode: "exact",
			explanation: null,
			deepExplanation: null,
		});
	});

	it("supports partial scoring with multiple answers", () => {
		const row = makeRow({
			answers: JSON.stringify(["A", "B"]),
			scoringMode: "partial",
			topic: null,
		});

		expect(parseQuestionRow(row)).toEqual({
			id: row.id,
			question: row.question,
			options: [
				{ key: "A", text: "First" },
				{ key: "B", text: "Second" },
			],
			answers: ["A", "B"],
			topic: null,
			scoringMode: "partial",
		});
	});

	it("returns null for invalid options JSON", () => {
		expect(parseQuestionRow(makeRow({ options: "not-json" }))).toBeNull();
	});

	it("returns null for invalid answers JSON", () => {
		expect(parseQuestionRow(makeRow({ answers: "{broken" }))).toBeNull();
	});

	it("returns null when answer key is missing from options", () => {
		expect(
			parseQuestionRow(makeRow({ answers: JSON.stringify(["Z"]) })),
		).toBeNull();
	});

	it("returns null for invalid scoring mode", () => {
		expect(parseQuestionRow(makeRow({ scoringMode: "invalid" }))).toBeNull();
	});
});
