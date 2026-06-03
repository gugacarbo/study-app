import { useMemo, useState } from "react";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import type { ExplanationProgressItem } from "@/features/exams/components/detail/exam-utils";

export function explanationAgentStateBadgeClass(
	state: "pending" | "running" | "done" | "error",
): string {
	switch (state) {
		case "done":
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
		case "error":
			return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
		case "running":
			return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
		default:
			return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
	}
}

function buildExplanationAgentSummary(
	agentRun: { meta?: { questionCount: number } } | null | undefined,
): string {
	const questionCount = agentRun?.meta?.questionCount;
	if (!questionCount) return "Inspect prompts, response, and agent state.";
	return `Inspect prompts, response, and agent state for this batch of ${questionCount} question${questionCount === 1 ? "" : "s"}.`;
}

export function useExplanationDialog(agentRuns: ExplanationAgentRunSummary[]) {
	const [selectedAgentRunId, setSelectedAgentRunId] = useState<string | null>(
		null,
	);

	const selectedAgentRun = useMemo(
		() =>
			selectedAgentRunId == null
				? null
				: (agentRuns.find(
						(agentRun) => agentRun.agentRunId === selectedAgentRunId,
					) ?? null),
		[agentRuns, selectedAgentRunId],
	);

	const buildSummary = useMemo(
		() => buildExplanationAgentSummary(selectedAgentRun),
		[selectedAgentRun],
	);

	function handleAgentRunClick(agentRunId: string) {
		setSelectedAgentRunId((prev) => (prev === agentRunId ? null : agentRunId));
	}

	function handleProgressClick(item: ExplanationProgressItem) {
		const agentRun = item.response?.agentRun;
		if (agentRun) {
			setSelectedAgentRunId((prev) =>
				prev === agentRun.agentRunId ? null : agentRun.agentRunId,
			);
		}
	}

	function handleDialogClose(nextOpen: boolean) {
		if (!nextOpen) setSelectedAgentRunId(null);
	}

	return {
		selectedAgentRun,
		selectedAgentRunId,
		buildSummary,
		setSelectedAgentRunId,
		handleAgentRunClick,
		handleProgressClick,
		handleDialogClose,
	};
}
