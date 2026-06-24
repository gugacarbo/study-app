import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleIcon, LoaderCircleIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import {
	IMPROVE_BATCH_PHASE,
	type ImproveQuestionsJobMetadata,
	JOB_STATUS,
	type JobStatus,
} from "@/lib/job-kinds";
import { cn } from "@/lib/utils";

type ImproveQuestionsProgressPanelProps = {
	status: JobStatus | null;
	error: string | null;
	metadata: ImproveQuestionsJobMetadata;
	monitor: ImproveMonitorState;
	isLoading: boolean;
};

const BATCH_STEPS = [
	IMPROVE_BATCH_PHASE.PREPARING_BATCH,
	IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS,
	IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS,
	IMPROVE_BATCH_PHASE.FINALIZING_BATCH,
] as const;

const BATCH_STEP_LABELS = {
	[IMPROVE_BATCH_PHASE.PREPARING_BATCH]: "Preparar lote",
	[IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS]: "Despachar agentes",
	[IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS]: "Processar questões",
	[IMPROVE_BATCH_PHASE.FINALIZING_BATCH]: "Finalizar lote",
} as const;

function stepIndex(phase: string | null): number {
	if (!phase) return -1;
	return BATCH_STEPS.indexOf(phase as (typeof BATCH_STEPS)[number]);
}

function StepIcon({
	done,
	active,
	failed,
}: {
	done: boolean;
	active: boolean;
	failed?: boolean;
}) {
	if (failed) {
		return <XCircleIcon className="size-4 text-destructive" aria-hidden />;
	}
	if (done) {
		return <CheckIcon className="size-4 text-primary" aria-hidden />;
	}
	if (active) {
		return <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden />;
	}
	return <CircleIcon className="size-4 text-muted-foreground" aria-hidden />;
}

export function ImproveQuestionsProgressPanel({
	status,
	error,
	metadata,
	monitor,
	isLoading,
}: ImproveQuestionsProgressPanelProps) {
	const currentStep =
		status === JOB_STATUS.COMPLETED ? BATCH_STEPS.length : stepIndex(monitor.batchPhase);

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-medium">Progresso</h2>
				<Badge variant={status === JOB_STATUS.FAILED ? "destructive" : "secondary"}>
					{status ?? "Carregando"}
				</Badge>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Carregando estado do job…</p>
			) : null}

			<div className="grid grid-cols-2 gap-2 text-sm">
				<div className="rounded-md border bg-muted/20 px-3 py-2">
					<p className="text-xs text-muted-foreground">Na fila</p>
					<p className="font-medium">{metadata.queuedCount}</p>
				</div>
				<div className="rounded-md border bg-muted/20 px-3 py-2">
					<p className="text-xs text-muted-foreground">Em execução</p>
					<p className="font-medium">{metadata.runningCount}</p>
				</div>
				<div className="rounded-md border bg-muted/20 px-3 py-2">
					<p className="text-xs text-muted-foreground">Concluídas</p>
					<p className="font-medium">{metadata.completedCount}</p>
				</div>
				<div className="rounded-md border bg-muted/20 px-3 py-2">
					<p className="text-xs text-muted-foreground">Falhas</p>
					<p className="font-medium">{metadata.failedCount}</p>
				</div>
			</div>

			<ol className="flex flex-col gap-3">
				{BATCH_STEPS.map((step, index) => {
					const done = currentStep > index;
					const active =
						status !== JOB_STATUS.COMPLETED &&
						status !== JOB_STATUS.FAILED &&
						status !== JOB_STATUS.CANCELLED &&
						currentStep === index;
					const failed =
						(status === JOB_STATUS.FAILED || status === JOB_STATUS.CANCELLED) &&
						currentStep === index;
					return (
						<li
							key={step}
							className={cn(
								"flex items-center gap-3 text-sm",
								done || active ? "text-foreground" : "text-muted-foreground",
							)}
						>
							<StepIcon done={done} active={active} failed={failed} />
							<span>{BATCH_STEP_LABELS[step]}</span>
						</li>
					);
				})}
			</ol>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mb-2 flex items-center justify-between">
					<h3 className="text-sm font-medium">Questões</h3>
					<Badge variant="outline">
						{metadata.pendingReviewCount} draft(s) pendente(s)
					</Badge>
				</div>
				<ul className="flex flex-col gap-2">
					{monitor.questions.map((question) => (
						<li
							key={question.questionId}
							className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="font-medium">
									Questão {question.questionNumber}
								</span>
								<Badge variant="outline">{question.status}</Badge>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Etapa atual: {question.stage}
							</p>
						</li>
					))}
				</ul>
			</div>

			{status === JOB_STATUS.COMPLETED && metadata.pendingReviewCount > 0 ? (
				<div className="border-t px-4 py-3">
					<Button asChild size="sm" className="w-full">
						<Link to="/exams/$examId" params={{ examId: metadata.examId }}>
							Revisar melhorias ({metadata.pendingReviewCount})
						</Link>
					</Button>
				</div>
			) : null}

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
