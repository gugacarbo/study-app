import type { QuestionImprovementSnapshot } from "@/db/queries/question-improvement-drafts";
import { describe, expect, it } from "vitest";
import {
	buildQuestionImprovementDiff,
	type QuestionImprovementDiffSection,
} from "@/features/exams/lib/build-question-improvement-diff";

function makeSnapshot(
	overrides: Partial<QuestionImprovementSnapshot> = {},
): QuestionImprovementSnapshot {
	return {
		question: "Qual alternativa esta correta?",
		options: [
			{ key: "A", text: "Primeira" },
			{ key: "B", text: "Segunda" },
		],
		answers: ["A"],
		topicId: "topic-1",
		topic: "Tema 1",
		scoringMode: "exact",
		explanation: "Explicacao curta",
		deepExplanation: null,
		...overrides,
	};
}

function expectChangedSections(
	actual: QuestionImprovementDiffSection[],
	expected: QuestionImprovementDiffSection[],
) {
	expect(actual).toEqual(expected);
}

describe("buildQuestionImprovementDiff", () => {
	it("returns only the stem section when just the question text changes", () => {
		const original = makeSnapshot();
		const improved = makeSnapshot({
			question: "Qual alternativa esta realmente correta?",
		});

		const diff = buildQuestionImprovementDiff({ original, improved });

		expect(diff.hasChanges).toBe(true);
		expectChangedSections(diff.changedSections, ["stem"]);
		expect(diff.sections.stem).toEqual({
			changed: true,
			original: "Qual alternativa esta correta?",
			improved: "Qual alternativa esta realmente correta?",
		});
		expect(diff.sections.metadata.changed).toBe(false);
	});

	it("returns only the metadata section when topic or scoring mode changes", () => {
		const original = makeSnapshot();
		const improved = makeSnapshot({
			topicId: "topic-2",
			topic: "Tema 2",
			scoringMode: "partial",
		});

		const diff = buildQuestionImprovementDiff({ original, improved });

		expect(diff.hasChanges).toBe(true);
		expectChangedSections(diff.changedSections, ["metadata"]);
		expect(diff.sections.metadata).toEqual({
			changed: true,
			original: {
				topicId: "topic-1",
				topic: "Tema 1",
				scoringMode: "exact",
			},
			improved: {
				topicId: "topic-2",
				topic: "Tema 2",
				scoringMode: "partial",
			},
		});
	});

	it("treats reordered options as an options change", () => {
		const original = makeSnapshot();
		const improved = makeSnapshot({
			options: [
				{ key: "B", text: "Segunda" },
				{ key: "A", text: "Primeira" },
			],
		});

		const diff = buildQuestionImprovementDiff({ original, improved });

		expect(diff.hasChanges).toBe(true);
		expectChangedSections(diff.changedSections, ["options"]);
		expect(diff.sections.options.changed).toBe(true);
		expect(diff.sections.options.original).toEqual(original.options);
		expect(diff.sections.options.improved).toEqual(improved.options);
	});

	it("returns only the answers section when the correct answers change", () => {
		const original = makeSnapshot();
		const improved = makeSnapshot({
			answers: ["B"],
		});

		const diff = buildQuestionImprovementDiff({ original, improved });

		expect(diff.hasChanges).toBe(true);
		expectChangedSections(diff.changedSections, ["answers"]);
		expect(diff.sections.answers).toEqual({
			changed: true,
			original: ["A"],
			improved: ["B"],
		});
	});

	it("marks explanation as changed when it is removed", () => {
		const original = makeSnapshot();
		const improved = makeSnapshot({
			explanation: null,
		});

		const diff = buildQuestionImprovementDiff({ original, improved });

		expect(diff.hasChanges).toBe(true);
		expectChangedSections(diff.changedSections, ["explanation"]);
		expect(diff.sections.explanation).toEqual({
			changed: true,
			original: "Explicacao curta",
			improved: null,
		});
	});

	it("returns no changes when snapshots only differ by null versus empty optional strings", () => {
		const original = makeSnapshot({
			topicId: undefined,
			topic: null,
			explanation: null,
			deepExplanation: "",
		});
		const improved = makeSnapshot({
			topicId: null,
			topic: "",
			explanation: "",
			deepExplanation: null,
		});

		const diff = buildQuestionImprovementDiff({ original, improved });

		expect(diff.hasChanges).toBe(false);
		expectChangedSections(diff.changedSections, []);
		expect(diff.sections.metadata.changed).toBe(false);
		expect(diff.sections.explanation.changed).toBe(false);
		expect(diff.sections.deepExplanation.changed).toBe(false);
	});
});
