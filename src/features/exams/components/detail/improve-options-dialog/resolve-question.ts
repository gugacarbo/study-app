import type { QuestionChange } from "@/features/ai/agents/improve-options/contracts";
import {
	remapAnswersForOptionRename,
	type QuestionData,
} from "../exam-utils";

type QuestionResolveSnapshot = Pick<
	QuestionData,
	"id" | "question" | "options" | "answers" | "explanation"
>;

function resolveScalarField(
	originalValue: string,
	draftValue: string,
	change: QuestionChange | undefined,
): string {
	if (!change) return originalValue;
	if (change.decision === "revert") return originalValue;
	return draftValue;
}

function resolveAnswers(
	original: QuestionResolveSnapshot,
	draft: QuestionResolveSnapshot,
	change: QuestionChange | undefined,
): string[] {
	if (!change) return [...original.answers];
	if (change.decision === "revert") return [...original.answers];
	return [...draft.answers];
}

function resolveOptions(
	original: QuestionResolveSnapshot,
	draft: QuestionResolveSnapshot,
	changes: QuestionChange[],
): string[] {
	const optionChanges = changes.filter((change) => change.field === "options");
	if (optionChanges.length === 0) return [...original.options];

	const changeByIndex = new Map(
		optionChanges.map((change) => [change.optionIndex as number, change]),
	);
	const maxLength = Math.max(original.options.length, draft.options.length);
	const resolved: string[] = [];

	for (let index = 0; index < maxLength; index += 1) {
		const change = changeByIndex.get(index);
		const originalValue = original.options[index];
		const draftValue = draft.options[index];

		if (!change) {
			if (originalValue !== undefined) resolved.push(originalValue);
			continue;
		}

		const useDraft = change.decision !== "revert";
		if (useDraft) {
			if (draftValue !== undefined) resolved.push(draftValue);
		} else if (originalValue !== undefined) {
			resolved.push(originalValue);
		}
	}

	return resolved;
}

function syncAnswersWithKeptOptionChanges(
	original: QuestionResolveSnapshot,
	draft: QuestionResolveSnapshot,
	answers: string[],
	changes: QuestionChange[],
	resolvedOptions: string[],
): string[] {
	let synced = [...answers];

	for (const change of changes) {
		if (change.field !== "options" || change.decision === "revert") continue;
		const index = change.optionIndex;
		if (index === undefined) continue;

		const oldText = original.options[index];
		const newText = draft.options[index];
		if (!oldText || !newText || oldText === newText) continue;

		synced = remapAnswersForOptionRename(synced, oldText, newText);
	}

	const resolvedOptionSet = new Set(
		resolvedOptions.map((option) => option.trim().toLowerCase()),
	);
	return synced.filter((answer) =>
		resolvedOptionSet.has(answer.trim().toLowerCase()),
	);
}

/**
 * Builds the preview question by applying keep/revert/pending decisions.
 * Pending entries use the draft value (same as keep during review).
 */
export function resolveQuestion(
	original: QuestionResolveSnapshot,
	draft: QuestionResolveSnapshot,
	changes: QuestionChange[],
): QuestionResolveSnapshot {
	const changeById = new Map(changes.map((change) => [change.id, change]));
	const resolvedOptions = resolveOptions(original, draft, changes);
	const resolvedAnswers = syncAnswersWithKeptOptionChanges(
		original,
		draft,
		resolveAnswers(original, draft, changeById.get("answer")),
		changes,
		resolvedOptions,
	);

	return {
		...original,
		options: resolvedOptions,
		answers: resolvedAnswers,
		explanation: resolveScalarField(
			original.explanation,
			draft.explanation,
			changeById.get("explanation"),
		),
	};
}
