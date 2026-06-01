import { Sparkles } from "lucide-react";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/use-explanation-generation";
import { Button } from "../ui/button";
import {
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { MarkdownRenderer } from "../ui/markdown";
import { Progress } from "../ui/progress";
import { ProgressItemButton } from "./progress-item-button";

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
	return (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Gerar explicações por agente</DialogTitle>
				<DialogDescription>
					O agente vai preencher `explanation` e `deepExplanation` das questões
					deste exame.
				</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col gap-3 text-sm">
				<div className="rounded-lg border border-border bg-muted p-3">
					<p className="font-medium">Pendentes</p>
					<p className="text-muted-foreground">
						{gen.pendingExplanationCount} de {questionCount} perguntas sem
						explicação completa.
					</p>
				</div>
				<div>
					<span className="text-xs font-semibold text-muted-foreground">
						Tamanho do batch (1-20)
					</span>
					<Input
						type="number"
						min={1}
						max={20}
						value={gen.batchSize}
						disabled={gen.generatingExplanations}
						onChange={(e) => {
							const value = Number(e.target.value);
							if (Number.isNaN(value)) return;
							gen.setBatchSize(Math.max(1, Math.min(20, value)));
						}}
						className="mt-1"
					/>
				</div>
				<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2.5">
					<input
						type="checkbox"
						checked={gen.overwriteExplanations}
						onChange={(e) => gen.setOverwriteExplanations(e.target.checked)}
						disabled={gen.generatingExplanations}
						className="accent-primary"
					/>
					<span>Sobrescrever explicações já existentes</span>
				</label>
				{gen.progressItems.length > 0 && (
					<div className="rounded-lg border border-border bg-card p-3">
						<div className="mb-2 flex items-center justify-between text-xs">
							<span className="font-semibold text-muted-foreground">
								Progresso por pergunta
							</span>
							<span className="text-muted-foreground">
								{gen.finishedCount}/{gen.progressItems.length} (
								{gen.progressPercent}%)
							</span>
						</div>
						<Progress value={gen.progressPercent} className="mb-2 h-2" />
						<div className="mb-2 text-xs text-muted-foreground">
							{gen.processingCount > 0 && `${gen.processingCount} processando`}
							{gen.processingCount > 0 && gen.errorCount > 0 && " • "}
							{gen.errorCount > 0 && `${gen.errorCount} com erro`}
						</div>
						<div className="max-h-48 flex flex-col gap-1.5 overflow-y-auto pr-1">
							{gen.progressItems.map((item) => (
								<ProgressItemButton
									key={item.id}
									item={item}
									questionOrder={gen.questionOrder}
									isSelected={gen.selectedResponseItemId === item.id}
									onSelect={gen.setSelectedResponseItemId}
								/>
							))}
						</div>
						{gen.selectedResponseItem?.response && (
							<div className="mt-3 rounded-lg border border-border bg-muted p-3">
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Resposta do agente · Q
									{gen.questionOrder.get(gen.selectedResponseItem.id) ?? "?"}
								</p>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Explanation
								</p>
								<MarkdownRenderer
									content={gen.selectedResponseItem.response.explanation}
									className="mb-2 text-sm"
								/>
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Deep Explanation
								</p>
								<MarkdownRenderer
									content={gen.selectedResponseItem.response.deepExplanation}
									className="text-sm"
								/>
							</div>
						)}
					</div>
				)}
				{gen.generationMessage && (
					<p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
						{gen.generationMessage}
					</p>
				)}
			</div>
			<DialogFooter>
				<Button
					type="button"
					onClick={gen.handleGenerateExplanations}
					disabled={gen.generatingExplanations || questionCount === 0}
				>
					<Sparkles data-icon="inline-start" />
					{gen.generatingExplanations ? "Gerando..." : "Gerar agora"}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}
