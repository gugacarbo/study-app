import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/explanation-generation";
import type { ExplanationProgressItem } from "./exam-utils";
import { ExplanationResults } from "./explanation-results";
import { PipelineControls } from "./pipeline-controls";

interface ExplanationPipelineTabProps {
	examId: number;
	questions: Array<{
		id: number;
		question: string;
		explanation: string;
		deepExplanation: string;
	}>;
}

export function ExplanationPipelineTab({
	examId,
	questions,
}: ExplanationPipelineTabProps) {
	const gen = useExplanationGeneration({ examId, questions, open: true });
	const [selectedAgentRun, setSelectedAgentRun] =
		useState<ExplanationAgentRunSummary | null>(null);

	function handleProgressItemClick(item: ExplanationProgressItem) {
		const agentRun =
			item.response?.agentRun ?? gen.findAgentRunForQuestionId(item.id);
		if (!agentRun) return;
		setSelectedAgentRun(agentRun);
	}

	function handleAgentRunClick(agentRunId: string) {
		const agentRun = gen.agentRuns.find((ar) => ar.agentRunId === agentRunId);
		if (agentRun) setSelectedAgentRun(agentRun);
	}

	function handleSelectedResponseAgentRunClick() {
		const agentRun = gen.selectedResponseItem?.response?.agentRun;
		if (agentRun) setSelectedAgentRun(agentRun);
	}

	const buildSummary = useMemo(() => {
		const questionCount = selectedAgentRun?.meta?.questionCount;
		if (!questionCount) return "Inspect prompts, response, and agent state.";
		return `Inspect prompts, response, and agent state for this batch of ${questionCount} question${questionCount === 1 ? "" : "s"}.`;
	}, [selectedAgentRun]);

	return (
		<div className="flex flex-col gap-3 text-sm">
			<Card size="sm">
				<CardContent>
					<h2 className="mb-1 text-lg font-semibold">
						Gerar explicacoes por agente
					</h2>
					<p className="text-xs text-muted-foreground">
						O agente preenche `explanation` e `deepExplanation` das questoes
						deste exame.
					</p>
				</CardContent>
			</Card>

			<PipelineControls
				generatingExplanations={gen.generatingExplanations}
				batchSize={gen.batchSize}
				overwriteExplanations={gen.overwriteExplanations}
				generationMessage={gen.generationMessage}
				questionCount={questions.length}
				pendingCount={gen.pendingExplanationCount}
				onBatchSizeChange={gen.setBatchSize}
				onOverwriteChange={gen.setOverwriteExplanations}
				onGenerate={gen.handleGenerateExplanations}
			/>

			<ExplanationResults
				progressItems={gen.progressItems}
				agentRuns={gen.agentRuns}
				selectedResponseItemId={gen.selectedResponseItemId}
				selectedResponseItem={gen.selectedResponseItem}
				questionOrder={gen.questionOrder}
				processingCount={gen.processingCount}
				errorCount={gen.errorCount}
				finishedCount={gen.finishedCount}
				progressPercent={gen.progressPercent}
				findAgentRunForQuestionId={gen.findAgentRunForQuestionId}
				setSelectedResponseItemId={gen.setSelectedResponseItemId}
				onProgressItemClick={handleProgressItemClick}
				onAgentRunClick={handleAgentRunClick}
				onSelectedResponseAgentRunClick={handleSelectedResponseAgentRunClick}
			/>

			<AgentRunDetailDialog
				name={selectedAgentRun?.label ?? ""}
				summary={buildSummary}
				systemPrompt={selectedAgentRun?.systemPrompt}
				userPrompt={selectedAgentRun?.userPrompt}
				response={selectedAgentRun?.rawText ?? selectedAgentRun?.error}
				open={selectedAgentRun != null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setSelectedAgentRun(null);
				}}
			/>
		</div>
	);
}
