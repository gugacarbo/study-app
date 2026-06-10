import type {
	ChangeDecision,
	QuestionChange,
} from "@/features/ai/agents/improve-options/contracts";
import type { QuestionData } from "../exam-utils";

type QuestionDiffSnapshot = Pick<
	QuestionData,
	"options" | "answers" | "explanation"
>;

function optionLabel(index: number): string {
	return `Option ${String.fromCharCode(65 + index)}`;
}

function createChangeId(
	field: QuestionChange["field"],
	optionIndex?: number,
): string {
	if (field === "options" && optionIndex !== undefined) {
		return `options-${optionIndex}`;
	}
	return field;
}

function normalizeAnswerSet(values: string[]): Set<string> {
	return new Set(
		values.map((value) => value.trim().toLowerCase()).filter(Boolean),
	);
}

function answersEqual(left: string[], right: string[]): boolean {
	const leftSet = normalizeAnswerSet(left);
	const rightSet = normalizeAnswerSet(right);
	if (leftSet.size !== rightSet.size) return false;
	for (const answer of leftSet) {
		if (!rightSet.has(answer)) return false;
	}
	return true;
}

function formatAnswers(answers: string[]): string {
	if (answers.length === 0) return "—";
	return answers.join(" · ");
}

/**
 * Compares original and draft snapshots into per-field / per-option change entries.
 */
export function computeQuestionChanges(
	original: QuestionDiffSnapshot,
	draft: QuestionDiffSnapshot,
): QuestionChange[] {
	const changes: QuestionChange[] = [];
	const maxOptions = Math.max(original.options.length, draft.options.length);

	for (let index = 0; index < maxOptions; index += 1) {
		const before = original.options[index] ?? "";
		const after = draft.options[index] ?? "";
		if (before === after) continue;

		changes.push({
			id: createChangeId("options", index),
			field: "options",
			optionIndex: index,
			label: optionLabel(index),
			before,
			after,
			decision: "pending",
		});
	}

	if (!answersEqual(original.answers, draft.answers)) {
		changes.push({
			id: createChangeId("answer"),
			field: "answer",
			label: "Correct answers",
			before: formatAnswers(original.answers),
			after: formatAnswers(draft.answers),
			decision: "pending",
		});
	}

	if (original.explanation !== draft.explanation) {
		changes.push({
			id: createChangeId("explanation"),
			field: "explanation",
			label: "Explanation",
			before: original.explanation,
			after: draft.explanation,
			decision: "pending",
		});
	}

	return changes;
}

/**
 * Applies keep-all or revert-all to every change entry.
 */
export function applyDecisions(
	changes: QuestionChange[],
	decision: Exclude<ChangeDecision, "pending">,
): QuestionChange[] {
	return changes.map((change) => ({ ...change, decision }));
}
