import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleIcon, LoaderCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IngestProgressState } from "@/features/background-processes/lib/ingest-event-mapper";
import { formatPhaseLabel } from "@/features/background-processes/lib/ingest-event-mapper";
import {
	INGEST_PHASE,
	type IngestJobMetadata,
	JOB_STATUS,
	type JobStatus,
} from "@/lib/job-kinds";
import { cn } from "@/lib/utils";

const INGEST_STEPS = [
	INGEST_PHASE.READING_FILE,
	INGEST_PHASE.EXTRACTING,
	INGEST_PHASE.REVIEWING,
	INGEST_PHASE.PERSISTING,
] as const;

const STEP_LABELS: Record<(typeof INGEST_STEPS)[number], string> = {
	[INGEST_PHASE.READING_FILE]: "Leitura",
	[INGEST_PHASE.EXTRACTING]: "Extração",
	[INGEST_PHASE.REVIEWING]: "Revisão",
	[INGEST_PHASE.PERSISTING]: "Persistência",
};

const STATUS_LABELS: Record<string, string> = {
	[JOB_STATUS.QUEUED]: "Na fila",
	[JOB_STATUS.RUNNING]: "Em andamento",
	[JOB_STATUS.COMPLETED]: "Concluído",
	[JOB_STATUS.FAILED]: "Falhou",
	[JOB_STATUS.CANCELLED]: "Cancelado",
};

type IngestProgressPanelProps = {
	status: JobStatus | null;
	phase: string | null;
	error: string | null;
	metadata: IngestJobMetadata | null;
	progress: IngestProgressState;
	isLoading: boolean;
};

function stepIndex(phase: string | null): number {
	if (!phase) return -1;
	return INGEST_STEPS.indexOf(phase as (typeof INGEST_STEPS)[number]);
}

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
	if (done) {
		return <CheckIcon className="size-4 text-primary" aria-hidden />;
	}
	if (active) {
		return (
			<LoaderCircleIcon
				className="size-4 animate-spin text-primary"
				aria-hidden
			/>
		);
	}
	return <CircleIcon className="size-4 text-muted-foreground" aria-hidden />;
}

export function IngestProgressPanel({
	status,
	phase,
	error,
	metadata,
	progress,
	isLoading,
}: IngestProgressPanelProps) {
	const activePhase = progress.phase ?? phase;
	const isSuccessTerminal = status === JOB_STATUS.COMPLETED;
	const isFailureTerminal =
		status === JOB_STATUS.FAILED || status === JOB_STATUS.CANCELLED;
	const currentStep = isSuccessTerminal
		? INGEST_STEPS.length
		: stepIndex(activePhase);
	const phaseLabel = isSuccessTerminal
		? "Importação concluída"
		: (formatPhaseLabel(
				activePhase as Parameters<typeof formatPhaseLabel>[0],
			) ?? "Aguardando início…");
	const statusLabel =
		status != null ? (STATUS_LABELS[status] ?? status) : "Carregando…";

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-medium">Progresso</h2>
				<Badge
					variant={status === JOB_STATUS.FAILED ? "destructive" : "secondary"}
				>
					{statusLabel}
				</Badge>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">
					Carregando estado do job…
				</p>
			) : null}

			<ol className="flex flex-col gap-3">
				{INGEST_STEPS.map((step, index) => {
					const done = currentStep > index;
					const active =
						!isSuccessTerminal &&
						!isFailureTerminal &&
						currentStep === index;
					return (
						<li
							key={step}
							className={cn(
								"flex items-center gap-3 text-sm",
								done || active ? "text-foreground" : "text-muted-foreground",
							)}
						>
							<StepIcon done={done} active={active} />
							<span>{STEP_LABELS[step]}</span>
						</li>
					);
				})}
			</ol>

			<div className="flex flex-col gap-1 text-sm">
				<p className="text-muted-foreground">{phaseLabel}</p>
				{progress.questionsSeen > 0 ? (
					<p>{progress.questionsSeen} questão(ões) identificada(s)</p>
				) : null}
				{progress.persisted != null ? (
					<p>{progress.persisted} salva(s)</p>
				) : null}
				{metadata?.fileName ? (
					<p className="truncate text-xs text-muted-foreground">
						Arquivo: {metadata.fileName}
					</p>
				) : null}
			</div>

			{progress.extractedQuestionsPreview.length > 0 ? (
				<div className="flex min-h-0 flex-col gap-2">
					<h3 className="text-sm font-medium">Questões extraídas</h3>
					<ol className="flex flex-col gap-2 overflow-y-auto pr-1">
						{progress.extractedQuestionsPreview.map((item) => (
							<li
								key={item.toolCallId}
								className="rounded-md border bg-muted/30 px-3 py-2"
							>
								<p className="text-sm leading-relaxed">{item.question}</p>
							</li>
						))}
					</ol>
				</div>
			) : null}

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}

			{status === JOB_STATUS.COMPLETED ? (
				<div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
					{metadata?.examId ? (
						<Button asChild>
							<Link
								to="/exams/$examId"
								params={{ examId: metadata.examId }}
							>
								Ver prova
							</Link>
						</Button>
					) : null}
					<Button asChild variant="outline">
						<Link to="/exams/new">Nova importação</Link>
					</Button>
					<Button asChild variant="secondary">
						<Link to="/exams">Ver provas</Link>
					</Button>
				</div>
			) : null}
		</div>
	);
}
