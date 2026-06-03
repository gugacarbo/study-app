import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { Progress } from "@/components/ui/progress";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import type { ExplanationProgressItem } from "@/features/exams/components/detail/exam-utils";
import { ProgressItemButton } from "@/features/exams/components/detail/progress-item-button";
import { cn } from "@/lib/utils";

interface ExplanationResultsProps {
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
		questionId: number,
	) => ExplanationAgentRunSummary | undefined;
	setSelectedResponseItemId: (id: number | null) => void;
	onProgressItemClick: (item: ExplanationProgressItem) => void;
	onAgentRunClick: (agentRunId: string) => void;
	onSelectedResponseAgentRunClick: () => void;
}

export function explanationAgentStateBadgeClass(
	state: "pending" | "running" | "done" | "error",
): string {
	switch (state) {
		case "done":
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
		case "error":
			return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
		case "running":
			return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
		default:
			return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
	}
}

export function ExplanationResults({
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
	setSelectedResponseItemId,
	onProgressItemClick,
	onAgentRunClick,
	onSelectedResponseAgentRunClick,
}: ExplanationResultsProps) {
	if (progressItems.length === 0) return null;

	return (
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
					<p className="mb-1 text-xs font-semibold text-muted-foreground">
						Resposta do agente · Q
						{questionOrder.get(selectedResponseItem.id) ?? "?"}
					</p>
					{selectedResponseItem.response.agentRun && (
						<button
							type="button"
							onClick={onSelectedResponseAgentRunClick}
							className="mb-2 block w-full rounded-md border border-border/70 bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-sky-400/40"
						>
							<p>
								{selectedResponseItem.response.agentRun.label} ·{" "}
								{selectedResponseItem.response.agentRun.agentRunId}
							</p>
							<p>Status: {selectedResponseItem.response.agentRun.status}</p>
						</button>
					)}
					<p className="mb-1 text-xs font-semibold text-muted-foreground">
						Explanation
					</p>
					<MarkdownRenderer
						content={selectedResponseItem.response.explanation}
						className="mb-2 text-sm"
					/>
					<p className="mb-1 text-xs font-semibold text-muted-foreground">
						Deep Explanation
					</p>
					<MarkdownRenderer
						content={selectedResponseItem.response.deepExplanation}
						className="text-sm"
					/>
				</div>
			)}
		</div>
	);
}
