import { Link } from "@tanstack/react-router";
import {
	CheckIcon,
	CircleAlertIcon,
	CircleIcon,
	LoaderCircleIcon,
	ListTodoIcon,
	XCircleIcon,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import { formatImproveQuestionStageLabel } from "@/features/background-processes/lib/improve-event-labels";
import {
	IMPROVE_BATCH_PHASE,
	type ImproveQuestionsJobMetadata,
	JOB_STATUS,
	type JobStatus,
	statusBadgeVariant,
} from "@/lib/job-kinds";
import { cn } from "@/lib/utils";

type ImproveQuestionsProgressPanelProps = {
	status: JobStatus | null;
	error: string | null;
	metadata: ImproveQuestionsJobMetadata;
	monitor: ImproveMonitorState;
	isLoading: boolean;
	isCancelling?: Record<string, boolean>;
	isRetrying?: Record<string, boolean>;
	onCancelQuestion?: (questionId: string) => void;
	onRetryQuestion?: (questionId: string) => void;
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

const COUNTER_ITEMS = [
	{
		key: "queuedCount",
		label: "Na fila",
		icon: ListTodoIcon,
		iconClassName: "text-muted-foreground",
	},
	{
		key: "runningCount",
		label: "Em execução",
		icon: LoaderCircleIcon,
		iconClassName: "text-primary",
	},
	{
		key: "completedCount",
		label: "Concluídas",
		icon: CheckIcon,
		iconClassName: "text-primary",
	},
	{
		key: "failedCount",
		label: "Falhas",
		icon: CircleAlertIcon,
		iconClassName: "text-destructive",
	},
] as const satisfies ReadonlyArray<{
	key: keyof Pick<
		ImproveQuestionsJobMetadata,
		"queuedCount" | "runningCount" | "completedCount" | "failedCount"
	>;
	label: string;
	icon: typeof ListTodoIcon;
	iconClassName: string;
}>;

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

function ImproveQuestionListItem({
	question,
	isCancelling,
	isRetrying,
	onCancelQuestion,
	onRetryQuestion,
}: {
	question: ImproveMonitorState["questions"][number];
	isCancelling?: boolean;
	isRetrying?: boolean;
	onCancelQuestion?: (questionId: string) => void;
	onRetryQuestion?: (questionId: string) => void;
}) {
	const canCancel = question.status === "running" || question.status === "queued";
	const canRetry = question.status === "failed" || question.status === "cancelled";

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-medium">Questão {question.questionNumber}</span>
				<Badge variant="outline" className="px-1.5 py-0 text-[11px]">
					{question.status}
				</Badge>
			</div>
			<p className="text-xs text-muted-foreground">
				Etapa atual: {formatImproveQuestionStageLabel(question.stage)}
			</p>
			{question.warnings[0] ? (
				<p className="text-xs text-amber-700">Alerta: {question.warnings[0]}</p>
			) : null}
			<div className="mt-1 flex flex-wrap items-center gap-2">
				{canCancel && onCancelQuestion ? (
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs"
						disabled={isCancelling}
						onClick={() => onCancelQuestion(question.questionId)}
					>
						{isCancelling ? "Cancelando…" : "Cancelar"}
					</Button>
				) : null}
				{canRetry && onRetryQuestion ? (
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs"
						disabled={isRetrying}
						onClick={() => onRetryQuestion(question.questionId)}
					>
						{isRetrying ? "Reiniciando…" : "Tentar novamente"}
					</Button>
				) : null}
			</div>
		</div>
	);
}

export function ImproveQuestionsProgressPanel({
	status,
	error,
	metadata,
	monitor,
	isLoading,
	isCancelling,
	isRetrying,
	onCancelQuestion,
	onRetryQuestion,
}: ImproveQuestionsProgressPanelProps) {
	const currentStep =
		status === JOB_STATUS.COMPLETED ? BATCH_STEPS.length : stepIndex(monitor.batchPhase);
	const isLiveJob =
		status === JOB_STATUS.QUEUED || status === JOB_STATUS.RUNNING;
	const livePendingReviewCount = monitor.questions.filter(
		(question) => question.status === "completed",
	).length;
	const pendingDraftCount = isLiveJob
		? livePendingReviewCount
		: metadata.pendingReviewCount;

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-sm font-medium">Progresso</h2>
				{(() => {
					const sv = statusBadgeVariant(status ?? "");
					return (
						<Badge variant={sv.variant} className={sv.className}>
							{status ?? "Carregando"}
						</Badge>
					);
				})()}
				</div>

				{isLoading ? (
					<p className="text-sm text-muted-foreground">Carregando estado do job…</p>
				) : null}

				<ul
					aria-label="Resumo do andamento das questões"
					className="flex flex-wrap gap-x-4 gap-y-2 text-sm"
				>
					{COUNTER_ITEMS.map((item) => {
						const Icon = item.icon;
						const isRunning = item.key === "runningCount" && metadata[item.key] > 0;
						return (
							<li key={item.key} className="flex items-center gap-2">
								<Icon
									aria-hidden
									className={cn("size-4 shrink-0", item.iconClassName, {
										"animate-spin": isRunning,
									})}
								/>
								<span className="text-muted-foreground">{item.label}</span>
								<span className="font-medium text-foreground">{metadata[item.key]}</span>
							</li>
						);
					})}
				</ul>

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

				<div className="flex min-h-40 flex-1 flex-col overflow-hidden">
					<div className="mb-2 hidden items-center justify-between md:flex">
						<h3 className="text-sm font-medium">Questões</h3>
						<Badge variant="outline">{pendingDraftCount} draft(s) pendente(s)</Badge>
					</div>
					<div
						aria-label="Lista de questões no mobile"
						className="min-h-40 flex-1 overflow-hidden md:hidden"
					>
						<Accordion
							type="single"
							collapsible
							defaultValue="questions"
							className="flex h-full min-h-0 flex-col"
						>
							<AccordionItem
								value="questions"
								className="flex min-h-0 flex-1 flex-col rounded-md border bg-muted/10"
							>
								<AccordionTrigger className="px-0 py-0 hover:no-underline">
									<div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2">
										<span className="text-sm font-medium">Questões</span>
										<Badge variant="outline">
											{pendingDraftCount} draft(s) pendente(s)
										</Badge>
									</div>
								</AccordionTrigger>
								<AccordionContent className="border-t px-3 py-3">
									<ul className="flex min-h-40 max-h-72 flex-col gap-1.5 overflow-y-auto">
										{monitor.questions.map((question) => (
											<li
												key={question.questionId}
												className="rounded-md border bg-muted/20 px-2.5 py-2"
											>
												<ImproveQuestionListItem
													question={question}
													isCancelling={isCancelling?.[question.questionId]}
													isRetrying={isRetrying?.[question.questionId]}
													onCancelQuestion={onCancelQuestion}
													onRetryQuestion={onRetryQuestion}
												/>
											</li>
										))}
									</ul>
								</AccordionContent>
								</AccordionItem>
							</Accordion>
						</div>
						<div
							aria-label="Lista de questões no desktop"
							className="hidden min-h-40 flex-1 overflow-y-auto md:block"
						>
							<ul className="flex flex-col gap-1.5">
								{monitor.questions.map((question) => (
									<li
										key={question.questionId}
										className="rounded-md border bg-muted/20 px-2.5 py-2"
									>
										<ImproveQuestionListItem
											question={question}
											isCancelling={isCancelling?.[question.questionId]}
											isRetrying={isRetrying?.[question.questionId]}
											onCancelQuestion={onCancelQuestion}
											onRetryQuestion={onRetryQuestion}
										/>
									</li>
								))}
							</ul>
						</div>
					</div>
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
