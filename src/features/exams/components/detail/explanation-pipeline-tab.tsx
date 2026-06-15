import { useState } from "react";
import { Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import { QuestionSelection } from "./improve-questions-batch-dialog/question-selection";
import { ExplainQuestionsAgentList } from "./explain-questions-batch/agent-list";
import { useExplainQuestionsBatch } from "./explain-questions-batch/use-explain-questions-batch";
import type { QuestionData } from "./exam-utils";

interface ExplanationPipelineTabProps {
	examId: number;
	questions: QuestionData[];
}

export function ExplanationPipelineTab({
	examId,
	questions,
}: ExplanationPipelineTabProps) {
	const batch = useExplainQuestionsBatch({ examId, questions });
	const [selectedAgentRun, setSelectedAgentRun] = useState<AgentRunState | null>(
		null,
	);

	function handleAgentClick(questionId: number) {
		const run = batch.getAgentRunForQuestion(questionId);
		if (run) setSelectedAgentRun(run);
	}

	return (
		<div className="flex min-h-[420px] flex-col gap-3 text-sm">
			<Card size="sm">
				<CardContent>
					<h2 className="mb-1 text-lg font-semibold">
						Gerar explicacoes por agente
					</h2>
					<p className="text-xs text-muted-foreground">
						Cada questao roda em um agente proprio com streaming, em paralelo.
						A execucao continua em background pelo gerenciador de processos do
						app.
					</p>
				</CardContent>
			</Card>

			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
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
					<>
						<div className="rounded-lg border border-border bg-muted p-3">
							<p className="font-medium">Pendentes</p>
							<p className="text-muted-foreground">
								{batch.pendingExplanationCount} de {questions.length} perguntas
								sem explicacao completa.
							</p>
						</div>

						<QuestionSelection
							questions={questions}
							selectAll={batch.selectAll}
							selectedIds={batch.selectedIds}
							disabled={false}
							onSelectAll={batch.handleSelectAll}
							onToggleQuestion={batch.toggleQuestion}
						/>

						<div className="shrink-0">
							<span className="text-xs font-semibold text-muted-foreground">
								Agentes em paralelo (1-20)
							</span>
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
								className="mt-1"
							/>
						</div>

						<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2.5">
							<input
								type="checkbox"
								checked={batch.overwriteExplanations}
								onChange={(e) =>
									batch.setOverwriteExplanations(e.target.checked)
								}
								className="accent-primary"
							/>
							<span>Sobrescrever explicacoes ja existentes</span>
						</label>
					</>
				)}
			</div>

			<div className="flex flex-wrap gap-2">
				{!batch.showAgentPanel ? (
					<Button
						type="button"
						onClick={batch.handleStart}
						disabled={
							batch.selectedCount === 0 ||
							questions.length === 0 ||
							batch.isBatchRunning
						}
					>
						<Sparkles data-icon="inline-start" />
						Gerar agora
					</Button>
				) : null}
				{batch.isBatchRunning ? (
					<Button type="button" variant="outline" onClick={batch.handleCancel}>
						<Square data-icon="inline-start" />
						Cancelar
					</Button>
				) : null}
			</div>

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
		</div>
	);
}
