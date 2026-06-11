import { Sparkles } from "lucide-react";
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
import type { QuestionData } from "../exam-utils";
import { BatchAgentList } from "./batch-agent-list";
import { QuestionSelection } from "./question-selection";
import { useImproveQuestionsBatch } from "./use-improve-questions-batch";

interface ImproveQuestionsBatchDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	examId: number;
	questions: QuestionData[];
	onOpenQuestion: (question: QuestionData) => void;
}

export function ImproveQuestionsBatchDialog({
	open,
	onOpenChange,
	examId,
	questions,
	onOpenQuestion,
}: ImproveQuestionsBatchDialogProps) {
	const batch = useImproveQuestionsBatch({ examId, questions, open });

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Melhorar questões com agente</DialogTitle>
					<DialogDescription>
						Selecione as questões e defina quantos agentes rodam em paralelo.
						Clique em um agente para revisar as melhorias.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 text-sm">
					<QuestionSelection
						questions={questions}
						selectAll={batch.selectAll}
						selectedIds={batch.selectedIds}
						disabled={batch.isBatchRunning}
						onSelectAll={batch.handleSelectAll}
						onToggleQuestion={batch.toggleQuestion}
					/>

					<div>
						<span className="text-xs font-semibold text-muted-foreground">
							Tamanho do batch (1-20)
						</span>
						<Input
							type="number"
							min={1}
							max={20}
							value={batch.batchSize}
							disabled={batch.isBatchRunning}
							onChange={(e) => {
								const value = Number(e.target.value);
								if (Number.isNaN(value)) return;
								batch.setBatchSize(Math.max(1, Math.min(20, value)));
							}}
							className="mt-1"
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							{batch.selectedCount} questão
							{batch.selectedCount === 1 ? "" : "ões"} selecionada
							{batch.selectedCount === 1 ? "" : "s"}
						</p>
					</div>

					{batch.hasAgents && (
						<BatchAgentList
							agentItems={batch.agentItems}
							finishedCount={batch.finishedCount}
							processingCount={batch.processingCount}
							errorCount={batch.errorCount}
							progressPercent={batch.progressPercent}
							onAgentClick={onOpenQuestion}
						/>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Fechar
					</Button>
					<Button
						type="button"
						onClick={batch.handleStart}
						disabled={
							batch.isBatchRunning ||
							batch.selectedCount === 0 ||
							questions.length === 0
						}
					>
						<Sparkles data-icon="inline-start" />
						{batch.isBatchRunning ? "Executando..." : "Iniciar melhorias"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
