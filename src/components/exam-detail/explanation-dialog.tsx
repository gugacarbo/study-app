import {
	AlertCircle,
	CheckCircle2,
	LoaderCircle,
	Sparkles,
} from "lucide-react";
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
import { useExplanationGeneration } from "./use-explanation-generation";

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

			<div className="space-y-3 text-sm">
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
							{gen.processingCount > 0 && (
								<span>{gen.processingCount} processando</span>
							)}
							{gen.processingCount > 0 && gen.errorCount > 0 && (
								<span> • </span>
							)}
							{gen.errorCount > 0 && <span>{gen.errorCount} com erro</span>}
						</div>
						<div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
							{gen.progressItems.map((item) => (
								<button
									type="button"
									key={item.id}
									disabled={item.status !== "done"}
									className={`w-full text-left rounded-md border border-border bg-muted px-2 py-1.5 ${
										item.status === "done"
											? "cursor-pointer hover:bg-card"
											: "cursor-default"
									} ${gen.selectedResponseItemId === item.id ? "ring-1 ring-primary/40" : ""}`}
									onClick={() => {
										if (item.status === "done")
											gen.setSelectedResponseItemId(item.id);
									}}
								>
									<div className="flex items-start gap-1.5">
										<span className="mt-0.5 shrink-0">
											{item.status === "processing" && (
												<LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
											)}
											{item.status === "done" && (
												<CheckCircle2 className="h-3.5 w-3.5 text-success" />
											)}
											{item.status === "error" && (
												<AlertCircle className="h-3.5 w-3.5 text-error" />
											)}
											{item.status === "pending" && (
												<div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50" />
											)}
											{item.status === "skipped" && (
												<div className="mt-1 h-2 w-2 rounded-full bg-success/60" />
											)}
										</span>
										<div className="min-w-0 flex-1">
											<p className="truncate text-xs font-medium text-foreground">
												Q{gen.questionOrder.get(item.id) ?? "?"} ·{" "}
												{item.question}
											</p>
											{item.message && (
												<p className="text-[11px] text-muted-foreground">
													{item.message}
												</p>
											)}
										</div>
									</div>
								</button>
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
					<Sparkles className="h-4 w-4" />
					{gen.generatingExplanations ? "Gerando..." : "Gerar agora"}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}
