import { Loader2, Sparkles, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import { ExplainQuestionsAgentList } from "../explain-questions-batch/agent-list";
import { useExplainQuestionsBatch } from "../explain-questions-batch/use-explain-questions-batch";
import type { QuestionData } from "../exam-utils";
import { QuestionSelection } from "../improve-questions-batch-dialog/question-selection";

interface ExplainQuestionsBatchDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	examId: number;
	questions: QuestionData[];
}

export function ExplainQuestionsBatchDialog({
	open,
	onOpenChange,
	examId,
	questions,
}: ExplainQuestionsBatchDialogProps) {
	const batch = useExplainQuestionsBatch({ examId, questions, open });
	const [selectedAgentRun, setSelectedAgentRun] = useState<AgentRunState | null>(
		null,
	);

	function handleAgentClick(questionId: number) {
		const run = batch.getAgentRunForQuestion(questionId);
		if (run) setSelectedAgentRun(run);
	}

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="flex h-[600px] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-4xl">
					<DialogHeader className="shrink-0">
						<DialogTitle>Gerar explicacoes com agente</DialogTitle>
						<DialogDescription>
							{batch.showAgentPanel
								? "Acompanhe o progresso dos agentes. Clique em um agente para inspecionar a execucao."
								: "Selecione as questoes e defina quantos agentes rodam em paralelo. A execucao continua em background ao fechar."}
						</DialogDescription>
					</DialogHeader>

					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden text-sm">
						{batch.showAgentPanel ? (
							<ExplainQuestionsAgentList
								agentItems={batch.agentItems}
								finishedCount={batch.finishedCount}
								processingCount={batch.processingCount}
								errorCount={batch.errorCount}
								progressPercent={batch.progressPercent}
								onAgentClick={handleAgentClick}
								onContinue={batch.handleContinue}
							/>
						) : (
							<QuestionSelection
								questions={questions}
								selectAll={batch.selectAll}
								selectedIds={batch.selectedIds}
								disabled={false}
								onSelectAll={batch.handleSelectAll}
								onToggleQuestion={batch.toggleQuestion}
								toolbar={
									<div className="grid shrink-0 grid-cols-4 gap-1.5">
										<label className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
											<input
												type="checkbox"
												checked={batch.selectAll}
												onChange={(e) => batch.handleSelectAll(e.target.checked)}
												className="accent-primary"
											/>
											<span className="truncate font-medium">Selecionar todas</span>
										</label>

										<label className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
											<input
												type="checkbox"
												checked={batch.overwriteExplanations}
												onChange={(e) =>
													batch.setOverwriteExplanations(e.target.checked)
												}
												className="accent-primary"
											/>
											<span className="truncate">Sobrescrever</span>
										</label>

										<div className="flex min-w-0 flex-col justify-center rounded-lg border border-border bg-muted px-2 py-1.5 text-xs leading-tight">
											<span className="font-medium">Pendentes</span>
											<span className="truncate text-muted-foreground">
												{batch.pendingExplanationCount}/{questions.length}
											</span>
										</div>

										<div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
											<span className="shrink-0 text-muted-foreground">Agentes</span>
											<Input
												type="number"
												min={1}
												max={20}
												value={batch.maxWorkers}
												onChange={(e) => {
													const value = Number(e.target.value);
													if (Number.isNaN(value)) return;
													batch.setMaxWorkers(Math.max(1, Math.min(20, value)));
												}}
												className="h-6 w-10 px-1 text-center text-xs"
											/>
											<span className="truncate text-muted-foreground">
												{batch.selectedCount} sel.
											</span>
										</div>
									</div>
								}
							/>
						)}
					</div>

					<DialogFooter className="shrink-0 gap-2 sm:justify-end">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Fechar
						</Button>
						{batch.isBatchRunning ? (
							<Button type="button" variant="outline" onClick={batch.handleCancel}>
								<Square data-icon="inline-start" />
								Cancelar
							</Button>
						) : null}
						{!batch.showAgentPanel ? (
							<Button
								type="button"
								onClick={batch.handleStart}
								disabled={batch.selectedCount === 0 || questions.length === 0}
							>
								<Sparkles data-icon="inline-start" />
								Gerar agora
							</Button>
						) : batch.isBatchRunning ? (
							<Button type="button" disabled>
								<Loader2 className="size-4 animate-spin" />
								Gerando…
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AgentRunDetailDialog
				name={selectedAgentRun?.label ?? ""}
				summary="Inspect prompts, response, and agent state for this explanation run."
				systemPrompt={selectedAgentRun?.systemPrompt}
				userPrompt={selectedAgentRun?.userPrompt}
				response={
					selectedAgentRun?.outputText ??
					selectedAgentRun?.error ??
					undefined
				}
				messages={selectedAgentRun?.messages}
				open={selectedAgentRun != null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setSelectedAgentRun(null);
				}}
			/>
		</>
	);
}
