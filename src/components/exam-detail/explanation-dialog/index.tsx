import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/explanation-generation";
import {
	DialogContent as DialogContentShell,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../../ui/dialog";
import { DialogActions } from "./dialog-actions";
import { DialogContent } from "./dialog-content";
import { useExplanationDialog } from "./use-explanation";

interface ExplanationDialogProps {
	open: boolean;
	examId: number;
	questions: Array<{
		id: number;
		question: string;
		explanation: string;
		deepExplanation: string;
	}>;
	questionCount: number;
}

export function ExplanationDialog({
	open,
	examId,
	questions,
	questionCount,
}: ExplanationDialogProps) {
	const gen = useExplanationGeneration({ examId, questions, open });
	const dlg = useExplanationDialog(gen.agentRuns);

	function handleProgressItemClick(item: (typeof gen.progressItems)[number]) {
		const agentRun =
			item.response?.agentRun ?? gen.findAgentRunForQuestionId(item.id);
		if (agentRun) {
			dlg.handleAgentRunClick(agentRun.agentRunId);
		}
	}

	return (
		<DialogContentShell className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Gerar explicações por agente</DialogTitle>
				<DialogDescription>
					O agente vai preencher `explanation` e `deepExplanation` das questões
					deste exame.
				</DialogDescription>
			</DialogHeader>
			<DialogContent
				generatingExplanations={gen.generatingExplanations}
				batchSize={gen.batchSize}
				overwriteExplanations={gen.overwriteExplanations}
				questionCount={questionCount}
				pendingExplanationCount={gen.pendingExplanationCount}
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
				setBatchSize={gen.setBatchSize}
				setOverwriteExplanations={gen.setOverwriteExplanations}
				setSelectedResponseItemId={gen.setSelectedResponseItemId}
				onAgentRunClick={dlg.handleAgentRunClick}
				onProgressItemClick={handleProgressItemClick}
				onSelectedResponseAgentRunClick={dlg.handleAgentRunClick}
			/>
			<AgentRunDetailDialog
				name={dlg.selectedAgentRun?.label ?? ""}
				summary={dlg.buildSummary}
				systemPrompt={dlg.selectedAgentRun?.systemPrompt}
				userPrompt={dlg.selectedAgentRun?.userPrompt}
				response={dlg.selectedAgentRun?.rawText ?? dlg.selectedAgentRun?.error}
				open={dlg.selectedAgentRun != null}
				onOpenChange={dlg.handleDialogClose}
			/>
			<DialogActions
				generatingExplanations={gen.generatingExplanations}
				questionCount={questionCount}
				generationMessage={gen.generationMessage}
				onGenerate={gen.handleGenerateExplanations}
			/>
		</DialogContentShell>
	);
}
