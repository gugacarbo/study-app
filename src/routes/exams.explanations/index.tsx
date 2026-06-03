import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { getExamDetail, getExamsDetailed } from "@/server-functions/exams";
import { ExplanationResults } from "./explanation-results";
import { PipelineControls } from "./pipeline-controls";
import { useExplanationPipeline } from "./use-explanation-pipeline";

export const Route = createFileRoute("/exams/explanations/")({
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

	const {
		gen,
		selectedAgentRun,
		buildSummary,
		setSelectedAgentRun,
		handleProgressItemClick,
	} = useExplanationPipeline({
		examId,
		questions: exam.questions,
		open: true,
	});

	function handleAgentRunClick(agentRunId: string) {
		const agentRun = gen.agentRuns.find((ar) => ar.agentRunId === agentRunId);
		if (agentRun) setSelectedAgentRun(agentRun);
	}

	function handleSelectedResponseAgentRunClick() {
		const agentRun = gen.selectedResponseItem?.response?.agentRun;
		if (agentRun) setSelectedAgentRun(agentRun);
	}

	return (
		<div className="flex flex-col gap-3 text-sm">
			<PipelineControls
				generatingExplanations={gen.generatingExplanations}
				batchSize={gen.batchSize}
				overwriteExplanations={gen.overwriteExplanations}
				generationMessage={gen.generationMessage}
				questionCount={exam.questions.length}
				pendingCount={gen.pendingExplanationCount}
				onBatchSizeChange={gen.setBatchSize}
				onOverwriteChange={gen.setOverwriteExplanations}
				onGenerate={gen.handleGenerateExplanations}
			/>
			<ExplanationResults
				progressItems={gen.progressItems}
				agentRuns={gen.agentRuns}
				selectedResponseItemId={gen.selectedResponseItemId}
				selectedResponseItem={gen.selectedResponseItem}
				questionOrder={gen.questionOrder}
				processingCount={gen.processingCount}
				errorCount={gen.errorCount}
				finishedCount={gen.finishedCount}
				progressPercent={gen.progressPercent}
				findAgentRunForQuestionId={gen.findAgentRunForQuestionId}
				setSelectedResponseItemId={gen.setSelectedResponseItemId}
				onProgressItemClick={handleProgressItemClick}
				onAgentRunClick={handleAgentRunClick}
				onSelectedResponseAgentRunClick={handleSelectedResponseAgentRunClick}
			/>
			<AgentRunDetailDialog
				name={selectedAgentRun?.label ?? ""}
				summary={buildSummary}
				systemPrompt={selectedAgentRun?.systemPrompt}
				userPrompt={selectedAgentRun?.userPrompt}
				response={selectedAgentRun?.rawText ?? selectedAgentRun?.error}
				open={selectedAgentRun != null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setSelectedAgentRun(null);
				}}
			/>
		</div>
	);
}
