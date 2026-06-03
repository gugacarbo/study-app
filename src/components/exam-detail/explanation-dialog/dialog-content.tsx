import { Sparkles } from "lucide-react";
import type { ExplanationProgressItem } from "@/components/exam-detail/exam-utils";
import { ProgressItemButton } from "@/components/exam-detail/progress-item-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { Progress } from "@/components/ui/progress";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { cn } from "@/lib/utils";
import { explanationAgentStateBadgeClass } from "./use-explanation";

interface DialogContentProps {
	generatingExplanations: boolean;
	batchSize: number;
	overwriteExplanations: boolean;
	questionCount: number;
	pendingExplanationCount: number;
	progressItems: ExplanationProgressItem[];
	agentRuns: ExplanationAgentRunSummary[];
	selectedResponseItemId: number | null;
	selectedResponseItem: ExplanationProgressItem | undefined;
	questionOrder: Map<number, number>;
	processingCount: number;
	errorCount: number;
	finishedCount: number;
	progressPercent: number;
	findAgentRunForQuestionId: (
		id: number,
	) => ExplanationAgentRunSummary | undefined;
	setBatchSize: (size: number) => void;
	setOverwriteExplanations: (overwrite: boolean) => void;
	setSelectedResponseItemId: (id: number | null) => void;
	onAgentRunClick: (agentRunId: string) => void;
	onProgressItemClick: (item: ExplanationProgressItem) => void;
	onSelectedResponseAgentRunClick: (agentRunId: string) => void;
}

export function DialogContent({
	generatingExplanations,
	batchSize,
	overwriteExplanations,
	questionCount,
	pendingExplanationCount,
	progressItems,
	agentRuns,
	selectedResponseItemId,
	selectedResponseItem,
	questionOrder,
	processingCount,
	errorCount,
	finishedCount,
	progressPercent,
	findAgentRunForQuestionId,
	setBatchSize,
	setOverwriteExplanations,
	setSelectedResponseItemId,
	onAgentRunClick,
	onProgressItemClick,
	onSelectedResponseAgentRunClick,
}: DialogContentProps) {
	return (
		<div className="flex flex-col gap-3 text-sm">
			<div className="rounded-lg border border-border bg-muted p-3">
				<p className="font-medium">Pendentes</p>
				<p className="text-muted-foreground">
					{pendingExplanationCount} de {questionCount} perguntas sem explicação
					completa.
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
					value={batchSize}
					disabled={generatingExplanations}
					onChange={(e) => {
						const value = Number(e.target.value);
						if (Number.isNaN(value)) return;
						setBatchSize(Math.max(1, Math.min(20, value)));
					}}
					className="mt-1"
				/>
			</div>
			<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2.5">
				<input
					type="checkbox"
					checked={overwriteExplanations}
					onChange={(e) => setOverwriteExplanations(e.target.checked)}
					disabled={generatingExplanations}
					className="accent-primary"
				/>
				<span>Sobrescrever explicações já existentes</span>
			</label>
			{progressItems.length > 0 && (
				<div className="rounded-lg border border-border bg-card p-3">
					<div className="mb-2 flex items-center justify-between text-xs">
						<span className="font-semibold text-muted-foreground">
							Progresso por pergunta
						</span>
						<span className="text-muted-foreground">
							{finishedCount}/{progressItems.length} ({progressPercent}%)
						</span>
					</div>
					<Progress value={progressPercent} className="mb-2 h-2" />
					<div className="mb-2 text-xs text-muted-foreground">
						{processingCount > 0 && `${processingCount} processando`}
						{processingCount > 0 && errorCount > 0 && " • "}
						{errorCount > 0 && `${errorCount} com erro`}
					</div>
					{agentRuns.length > 0 ? (
						<div className="mb-3 max-h-36 overflow-y-auto rounded-md border border-border bg-muted p-2">
							<div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80">
								<Sparkles className="size-3.5 text-sky-500 dark:text-sky-300" />
								Agents
							</div>
							<div className="grid gap-1.5">
								{agentRuns.map((agentRun) => (
									<button
										key={agentRun.agentRunId}
										type="button"
										onClick={() => onAgentRunClick(agentRun.agentRunId)}
										className="flex items-center gap-2 rounded-md border border-border bg-accent px-2.5 py-1.5 text-left transition-colors hover:border-sky-400/40 hover:bg-accent"
									>
										<span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-foreground">
											{agentRun.label}
										</span>
										<Badge
											variant="secondary"
											className={cn(
												"shrink-0 text-[0.6rem]",
												explanationAgentStateBadgeClass(agentRun.status),
											)}
										>
											{agentRun.status}
										</Badge>
									</button>
								))}
							</div>
						</div>
					) : null}
					<div className="max-h-48 flex flex-col gap-1.5 overflow-y-auto pr-1">
						{progressItems.map((item) => (
							<ProgressItemButton
								key={item.id}
								item={item}
								questionOrder={questionOrder}
								isSelected={selectedResponseItemId === item.id}
								canOpenDialog={Boolean(
									item.response?.agentRun ?? findAgentRunForQuestionId(item.id),
								)}
								onSelect={setSelectedResponseItemId}
								onClick={onProgressItemClick}
							/>
						))}
					</div>
					{selectedResponseItem?.response && (
						<div className="mt-3 rounded-lg border border-border bg-muted p-3">
							<p className="text-xs font-semibold text-muted-foreground mb-1">
								Resposta do agente · Q
								{questionOrder.get(selectedResponseItem.id) ?? "?"}
							</p>
							{selectedResponseItem.response.agentRun && (
								<button
									type="button"
									onClick={() =>
										onSelectedResponseAgentRunClick(
											selectedResponseItem.response?.agentRun?.agentRunId ?? "",
										)
									}
									className="mb-2 block w-full rounded-md border border-border/70 bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-sky-400/40"
								>
									<p>
										{selectedResponseItem.response.agentRun.label} ·{" "}
										{selectedResponseItem.response.agentRun.agentRunId}
									</p>
									<p>Status: {selectedResponseItem.response.agentRun.status}</p>
								</button>
							)}
							<p className="text-xs font-semibold text-muted-foreground mb-1">
								Explanation
							</p>
							<MarkdownRenderer
								content={selectedResponseItem.response.explanation}
								className="mb-2 text-sm"
							/>
							<p className="text-xs font-semibold text-muted-foreground mb-1">
								Deep Explanation
							</p>
							<MarkdownRenderer
								content={selectedResponseItem.response.deepExplanation}
								className="text-sm"
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
