import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { ExplanationProgressItem } from "@/components/exam-detail/exam-utils";
import { Badge } from "@/components/ui/badge";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/use-explanation-generation";
import { cn } from "@/lib/utils";
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
	const [selectedAgentRunId, setSelectedAgentRunId] = useState<string | null>(
		null,
	);
	const selectedAgentRun = useMemo(
		() =>
			selectedAgentRunId == null
				? null
				: (gen.agentRuns.find(
						(agentRun) => agentRun.agentRunId === selectedAgentRunId,
					) ?? null),
		[gen.agentRuns, selectedAgentRunId],
	);

	function handleProgressItemClick(item: ExplanationProgressItem) {
		const agentRun = item.response?.agentRun;
		if (!agentRun) return;
		setSelectedAgentRunId(agentRun.agentRunId);
	}

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
						{gen.agentRuns.length > 0 ? (
							<div className="mb-3 max-h-36 overflow-y-auto rounded-md border border-border bg-muted p-2">
								<div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80">
									<Sparkles className="size-3.5 text-sky-500 dark:text-sky-300" />
									Agents
								</div>
								<div className="grid gap-1.5">
									{gen.agentRuns.map((agentRun) => (
										<button
											key={agentRun.agentRunId}
											type="button"
											onClick={() => setSelectedAgentRunId(agentRun.agentRunId)}
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
							{gen.progressItems.map((item) => (
								<ProgressItemButton
									key={item.id}
									item={item}
									questionOrder={gen.questionOrder}
									isSelected={gen.selectedResponseItemId === item.id}
									onSelect={gen.setSelectedResponseItemId}
									onClick={handleProgressItemClick}
								/>
							))}
						</div>
						{gen.selectedResponseItem?.response && (
							<div className="mt-3 rounded-lg border border-border bg-muted p-3">
								<p className="text-xs font-semibold text-muted-foreground mb-1">
									Resposta do agente · Q
									{gen.questionOrder.get(gen.selectedResponseItem.id) ?? "?"}
								</p>
								{gen.selectedResponseItem.response.agentRun && (
									<button
										type="button"
										onClick={() =>
											setSelectedAgentRunId(
												gen.selectedResponseItem?.response?.agentRun
													?.agentRunId ?? null,
											)
										}
										className="mb-2 block w-full rounded-md border border-border/70 bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-sky-400/40"
									>
										<p>
											{gen.selectedResponseItem.response.agentRun.label} ·{" "}
											{gen.selectedResponseItem.response.agentRun.agentRunId}
										</p>
										<p>
											Status:{" "}
											{gen.selectedResponseItem.response.agentRun.status}
										</p>
									</button>
								)}
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
			<AgentRunDetailDialog
				name={selectedAgentRun?.label ?? ""}
				summary={buildExplanationAgentSummary(selectedAgentRun)}
				systemPrompt={selectedAgentRun?.systemPrompt}
				userPrompt={selectedAgentRun?.userPrompt}
				response={selectedAgentRun?.rawText ?? selectedAgentRun?.error}
				open={selectedAgentRun != null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setSelectedAgentRunId(null);
				}}
			/>
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

function explanationAgentStateBadgeClass(
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

function buildExplanationAgentSummary(
	agentRun:
		| {
				meta?: {
					questionCount: number;
				};
		  }
		| null
		| undefined,
): string {
	const questionCount = agentRun?.meta?.questionCount;
	if (!questionCount) return "Inspect prompts, response, and agent state.";
	return `Inspect prompts, response, and agent state for this batch of ${questionCount} question${questionCount === 1 ? "" : "s"}.`;
}
