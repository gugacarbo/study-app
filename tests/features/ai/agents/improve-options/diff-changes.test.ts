import { describe, expect, it } from "vitest";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import {
	applyDecisions,
	computeQuestionChanges,
} from "@/features/exams/components/detail/improve-options-dialog/diff-changes";
import { resolveQuestion } from "@/features/exams/components/detail/improve-options-dialog/resolve-question";

function makeQuestion(
	overrides: Partial<QuestionData> & Pick<QuestionData, "id">,
): QuestionData {
	return {
		exam_id: null,
		question: overrides.question ?? "What is 2 + 2?",
		options: overrides.options ?? ["3", "4", "5"],
		answers: overrides.answers ?? ["4"],
		scoringMode: overrides.scoringMode ?? "exact",
		explanation: overrides.explanation ?? "Basic arithmetic.",
		deepExplanation: "",
		topic: "General",
		...overrides,
	};
}

describe("computeQuestionChanges", () => {
	it("returns no changes when original and draft match", () => {
		const question = makeQuestion({ id: 1 });
		expect(computeQuestionChanges(question, { ...question })).toEqual([]);
	});

	it("detects per-option text changes with stable ids and labels", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B", "C"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B revised", "C"],
		});

		const changes = computeQuestionChanges(original, draft);

		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			id: "options-1",
			field: "options",
			optionIndex: 1,
			label: "Option B",
			before: "B",
			after: "B revised",
			decision: "pending",
		});
	});

	it("detects newly added options with empty before value", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B", "C", "D", "E"],
		});

		const changes = computeQuestionChanges(original, draft);

		expect(changes.map((change) => change.optionIndex)).toEqual([2, 3, 4]);
		expect(changes[0]).toMatchObject({
			id: "options-2",
			label: "Option C",
			before: "",
			after: "C",
		});
	});

	it("detects removed options with empty after value", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B", "C", "D", "E"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B", "C"],
		});

		const changes = computeQuestionChanges(original, draft);

		expect(changes.map((change) => change.optionIndex)).toEqual([3, 4]);
		expect(changes[0]).toMatchObject({
			before: "D",
			after: "",
		});
	});

	it("detects answers and explanation field changes", () => {
		const original = makeQuestion({
			id: 1,
			answers: ["4"],
			explanation: "Old explanation",
		});
		const draft = makeQuestion({
			id: 1,
			answers: ["4", "5"],
			explanation: "New explanation",
		});

		const changes = computeQuestionChanges(original, draft);

		expect(changes).toHaveLength(2);
		expect(changes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "answer",
					field: "answer",
					label: "Correct answers",
					before: "4",
					after: "4 · 5",
				}),
				expect.objectContaining({
					id: "explanation",
					field: "explanation",
					label: "Explanation",
					before: "Old explanation",
					after: "New explanation",
				}),
			]),
		);
	});
});

describe("applyDecisions", () => {
	it("sets keep on every change", () => {
		const original = makeQuestion({ id: 1, answers: ["4"] });
		const draft = makeQuestion({ id: 1, answers: ["5"] });
		const changes = computeQuestionChanges(original, draft);

		const kept = applyDecisions(changes, "keep");

		expect(kept.every((change) => change.decision === "keep")).toBe(true);
	});

	it("sets revert on every change", () => {
		const original = makeQuestion({ id: 1, options: ["A", "B"] });
		const draft = makeQuestion({ id: 1, options: ["A", "B", "C"] });
		const changes = computeQuestionChanges(original, draft);

		const reverted = applyDecisions(changes, "revert");

		expect(reverted.every((change) => change.decision === "revert")).toBe(
			true,
		);
	});
});

describe("resolveQuestion", () => {
	it("uses draft values for pending decisions", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B"],
			answers: ["A"],
			explanation: "Old",
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B revised", "C"],
			answers: ["B revised"],
			explanation: "New",
		});
		const changes = computeQuestionChanges(original, draft);

		const resolved = resolveQuestion(original, draft, changes);

		expect(resolved.options).toEqual(["A", "B revised", "C"]);
		expect(resolved.answers).toEqual(["B revised"]);
		expect(resolved.explanation).toBe("New");
		expect(resolved.question).toBe(original.question);
	});

	it("reverts a single option while keeping other pending changes", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B", "C"],
			answers: ["A"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B revised", "C revised"],
			answers: ["C revised"],
		});
		const changes = computeQuestionChanges(original, draft).map((change) =>
			change.id === "options-1"
				? { ...change, decision: "revert" as const }
				: change,
		);

		const resolved = resolveQuestion(original, draft, changes);

		expect(resolved.options).toEqual(["A", "B", "C revised"]);
		expect(resolved.answers).toEqual(["C revised"]);
	});

	it("drops a newly added option when reverted", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B", "C"],
		});
		const changes = applyDecisions(
			computeQuestionChanges(original, draft),
			"revert",
		);

		const resolved = resolveQuestion(original, draft, changes);

		expect(resolved.options).toEqual(["A", "B"]);
	});

	it("restores a removed option when reverted", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B", "C"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B"],
		});
		const changes = applyDecisions(
			computeQuestionChanges(original, draft),
			"revert",
		);

		const resolved = resolveQuestion(original, draft, changes);

		expect(resolved.options).toEqual(["A", "B", "C"]);
	});

	it("returns original editable fields when there are no changes", () => {
		const original = makeQuestion({ id: 1 });
		const draft = { ...original };

		const resolved = resolveQuestion(original, draft, []);

		expect(resolved.options).toEqual(original.options);
		expect(resolved.answers).toEqual(original.answers);
		expect(resolved.explanation).toBe(original.explanation);
	});

	it("remaps answers when a kept option text changes", () => {
		const original = makeQuestion({
			id: 1,
			options: ["A", "B"],
			answers: ["B"],
		});
		const draft = makeQuestion({
			id: 1,
			options: ["A", "B revised"],
			answers: ["B"],
		});
		const changes = computeQuestionChanges(original, draft).map((change) =>
			change.field === "answer"
				? { ...change, decision: "revert" as const }
				: change,
		);

		const resolved = resolveQuestion(original, draft, changes);

		expect(resolved.answers).toEqual(["B revised"]);
	});
});
