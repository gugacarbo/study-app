import { Loader2, Sparkles } from "lucide-react";
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
			<DialogContent className="flex h-[600px] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-4xl">
				<DialogHeader className="shrink-0">
					<DialogTitle>Melhorar questões com agente</DialogTitle>
					<DialogDescription>
						{batch.isBatchComplete
							? "Execução concluída. Clique em um agente para revisar as melhorias."
							: batch.showAgentPanel
								? "Acompanhe o progresso dos agentes. Clique em um agente para revisar as melhorias."
								: "Selecione as questões e defina quantos agentes rodam em paralelo."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden text-sm">
					{batch.showAgentPanel ? (
						<BatchAgentList
							agentItems={batch.agentItems}
							finishedCount={batch.finishedCount}
							processingCount={batch.processingCount}
							errorCount={batch.errorCount}
							progressPercent={batch.progressPercent}
							onAgentClick={onOpenQuestion}
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
								<div className="flex shrink-0 items-center gap-1.5">
									<label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5">
										<input
											type="checkbox"
											checked={batch.selectAll}
											onChange={(e) => batch.handleSelectAll(e.target.checked)}
											className="accent-primary"
										/>
										<span className="truncate text-xs font-medium">
											Selecionar todas
										</span>
									</label>

									<div className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5">
										<span className="whitespace-nowrap text-xs text-muted-foreground">
											Agentes (1-20)
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
											className="h-7 w-12 px-2"
										/>
										<span className="whitespace-nowrap text-xs text-muted-foreground">
											{batch.selectedCount} selecionada
											{batch.selectedCount === 1 ? "" : "s"}
										</span>
									</div>
								</div>
							}
						/>
					)}
				</div>

				<DialogFooter className="shrink-0 gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={batch.applyingAll}
					>
						Fechar
					</Button>
					{batch.isBatchComplete ? (
						<Button
							type="button"
							variant="outline"
							onClick={batch.handleClear}
							disabled={batch.applyingAll}
						>
							Limpar execução
						</Button>
					) : null}
					{batch.showAgentPanel && batch.readyToApplyCount > 0 && (
						<Button
							type="button"
							onClick={batch.handleApplyAll}
							disabled={batch.applyingAll}
						>
							{batch.applyingAll ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Aplicando…
								</>
							) : (
								`Aplicar todos (${batch.readyToApplyCount})`
							)}
						</Button>
					)}
					{!batch.showAgentPanel && (
						<Button
							type="button"
							onClick={batch.handleStart}
							disabled={batch.selectedCount === 0 || questions.length === 0}
						>
							<Sparkles data-icon="inline-start" />
							Iniciar melhorias
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
