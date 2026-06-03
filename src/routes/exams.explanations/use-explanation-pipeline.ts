import { useMemo, useState } from "react";
import type { ExplanationProgressItem } from "@/components/exam-detail/exam-utils";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/explanation-generation";

interface UseExplanationPipelineProps {
	examId: number;
	questions: Array<{
		id: number;
		question: string;
		explanation: string;
		deepExplanation: string;
	}>;
	open: boolean;
}

export function useExplanationPipeline({
	examId,
	questions,
	open,
}: UseExplanationPipelineProps) {
	const gen = useExplanationGeneration({ examId, questions, open });
	const [selectedAgentRun, setSelectedAgentRun] =
		useState<ExplanationAgentRunSummary | null>(null);

	function handleProgressItemClick(item: ExplanationProgressItem) {
		const agentRun =
			item.response?.agentRun ?? gen.findAgentRunForQuestionId(item.id);
		if (!agentRun) return;
		setSelectedAgentRun(agentRun);
	}

	const buildSummary = useMemo(() => {
		const questionCount = selectedAgentRun?.meta?.questionCount;
		if (!questionCount) return "Inspect prompts, response, and agent state.";
		return `Inspect prompts, response, and agent state for this batch of ${questionCount} question${questionCount === 1 ? "" : "s"}.`;
	}, [selectedAgentRun]);

	return {
		gen,
		selectedAgentRun,
		buildSummary,
		setSelectedAgentRun,
		handleProgressItemClick,
	};
}
