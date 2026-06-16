import type { ChangeDecision } from "@/features/ai/agents/improve-questions/contracts";
import type { ExplanationChange } from "@/features/ai/agents/explanations/explain-question/contracts";

export interface ExplanationSnapshot {
	explanation: string;
	deepExplanation: string;
}

export function computeExplanationChanges(
	original: ExplanationSnapshot,
	draft: ExplanationSnapshot,
): ExplanationChange[] {
	const changes: ExplanationChange[] = [];

	if (original.explanation !== draft.explanation) {
		changes.push({
			id: "explanation",
			field: "explanation",
			label: "Explanation",
			before: original.explanation,
			after: draft.explanation,
			decision: "pending",
		});
	}

	if (original.deepExplanation !== draft.deepExplanation) {
		changes.push({
			id: "deepExplanation",
			field: "deepExplanation",
			label: "Deep explanation",
			before: original.deepExplanation,
			after: draft.deepExplanation,
			decision: "pending",
		});
	}

	return changes;
}

export function applyExplanationDecisions(
	changes: ExplanationChange[],
	decision: Exclude<ChangeDecision, "pending">,
): ExplanationChange[] {
	return changes.map((change) => ({ ...change, decision }));
}

export function resolveExplanations(
	original: ExplanationSnapshot,
	draft: ExplanationSnapshot,
	changes: ExplanationChange[],
): ExplanationSnapshot {
	const changeById = new Map(changes.map((change) => [change.id, change]));

	const resolveField = (
		field: "explanation" | "deepExplanation",
	): string => {
		const change = changeById.get(field);
		if (!change || change.decision === "revert") {
			return original[field];
		}
		return draft[field];
	};

	return {
		explanation: resolveField("explanation"),
		deepExplanation: resolveField("deepExplanation"),
	};
}

export function getRunPreviewExplanations(
	run: {
		originalSnapshot: ExplanationSnapshot;
		explanation: string;
		deepExplanation: string;
		changes: ExplanationChange[];
	},
): ExplanationSnapshot {
	if (run.changes.length === 0) {
		return {
			explanation: run.explanation,
			deepExplanation: run.deepExplanation,
		};
	}

	return resolveExplanations(
		{
			explanation: run.originalSnapshot.explanation,
			deepExplanation: run.originalSnapshot.deepExplanation,
		},
		{
			explanation: run.explanation,
			deepExplanation: run.deepExplanation,
		},
		run.changes,
	);
}
