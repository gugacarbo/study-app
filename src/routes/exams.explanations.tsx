import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { ExplanationProgressItem } from "@/components/exam-detail/exam-utils";
import { ProgressItemButton } from "@/components/exam-detail/progress-item-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/use-explanation-generation";
import { cn } from "@/lib/utils";
import { getExamDetail, getExamsDetailed } from "@/server-functions/exams";

export const Route = createFileRoute("/exams/explanations")({
	component: ExplanationsPage,
});

function ExplanationsPage() {
	const { data: exams } = useSuspenseQuery({
		queryKey: ["exams-detailed"],
		queryFn: () => getExamsDetailed(),
	});

	const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

	return (
		<div className="flex flex-col gap-3">
			<Card size="sm">
				<CardContent>
					<h2 className="mb-1 text-lg font-semibold">
						Gerar explicações por agente
					</h2>
					<p className="mb-3 text-xs text-muted-foreground">
						O agente preenche `explanation` e `deepExplanation` das questões do
						exame selecionado.
					</p>
					<div className="max-w-xs">
						<Select
							value={selectedExamId?.toString() ?? ""}
							onValueChange={(v) => setSelectedExamId(v ? Number(v) : null)}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Selecione um exame..." />
							</SelectTrigger>
							<SelectContent>
								{exams.map((exam) => (
									<SelectItem key={exam.id} value={exam.id.toString()}>
										{exam.name} ({exam.questionCount} questões)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{selectedExamId != null ? (
				<ExplanationContent examId={selectedExamId} />
			) : (
				<Card size="sm" className="text-center text-muted-foreground text-sm">
					<CardContent>
						Selecione um exame acima para gerar explicações.
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function ExplanationContent({ examId }: { examId: number }) {
	const { data: exam } = useSuspenseQuery({
		queryKey: ["exam-detail", examId],
		queryFn: () => getExamDetail({ data: { id: examId } }),
	});

	const gen = useExplanationGeneration({
		examId,
		questions: exam.questions,
		open: true,
	});
	const [selectedAgentRun, setSelectedAgentRun] =
		useState<ExplanationAgentRunSummary | null>(null);

	function handleSelectAgentRun(agentRun: ExplanationAgentRunSummary) {
		setSelectedAgentRun(agentRun);
	}

	function handleSelectSelectedResponseAgentRun() {
		const agentRun = gen.selectedResponseItem?.response?.agentRun;
		if (!agentRun) return;
		setSelectedAgentRun(agentRun);
	}

	function handleAgentRunDialogChange(nextOpen: boolean) {
		if (!nextOpen) setSelectedAgentRun(null);
	}

	function handleAgentRunCardClick(agentRun: ExplanationAgentRunSummary) {
		handleSelectAgentRun(agentRun);
	}

	function handleSelectedResponseAgentRunClick() {
		handleSelectSelectedResponseAgentRun();
	}

	function handleProgressItemClick(item: ExplanationProgressItem) {
		const agentRun = item.response?.agentRun;
		if (!agentRun) return;
		handleSelectAgentRun(agentRun);
	}

	function handleAgentRunClose(nextOpen: boolean) {
		handleAgentRunDialogChange(nextOpen);
	}

	return (
		<div className="flex flex-col gap-3 text-sm">
			<div className="rounded-lg border border-border bg-muted p-3">
				<p className="font-medium">Pendentes</p>
				<p className="text-muted-foreground">
					{gen.pendingExplanationCount} de {exam.questions.length} perguntas sem
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
										onClick={() => handleAgentRunCardClick(agentRun)}
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
							<p className="mb-1 text-xs font-semibold text-muted-foreground">
								Resposta do agente · Q
								{gen.questionOrder.get(gen.selectedResponseItem.id) ?? "?"}
							</p>
							{gen.selectedResponseItem.response.agentRun && (
								<button
									type="button"
									onClick={handleSelectedResponseAgentRunClick}
									className="mb-2 block w-full rounded-md border border-border/70 bg-card px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-sky-400/40"
								>
									<p>
										{gen.selectedResponseItem.response.agentRun.label} ·{" "}
										{gen.selectedResponseItem.response.agentRun.agentRunId}
									</p>
									<p>
										Status: {gen.selectedResponseItem.response.agentRun.status}
									</p>
								</button>
							)}
							<p className="mb-1 text-xs font-semibold text-muted-foreground">
								Explanation
							</p>
							<MarkdownRenderer
								content={gen.selectedResponseItem.response.explanation}
								className="mb-2 text-sm"
							/>
							<p className="mb-1 text-xs font-semibold text-muted-foreground">
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
			<AgentRunDetailDialog
				name={selectedAgentRun?.label ?? ""}
				summary={buildExplanationAgentSummary(selectedAgentRun)}
				systemPrompt={selectedAgentRun?.systemPrompt}
				userPrompt={selectedAgentRun?.userPrompt}
				response={selectedAgentRun?.rawText ?? selectedAgentRun?.error}
				open={selectedAgentRun != null}
				onOpenChange={handleAgentRunClose}
			/>
			{gen.generationMessage && (
				<p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
					{gen.generationMessage}
				</p>
			)}
			<Button
				type="button"
				onClick={gen.handleGenerateExplanations}
				disabled={gen.generatingExplanations || exam.questions.length === 0}
			>
				<Sparkles data-icon="inline-start" />
				{gen.generatingExplanations ? "Gerando..." : "Gerar agora"}
			</Button>
		</div>
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
