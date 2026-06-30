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
}: {
	question: ImproveMonitorState["questions"][number];
}) {
	return (
		<>
			<div className="flex items-center justify-between gap-2">
				<span className="font-medium">Questão {question.questionNumber}</span>
				<Badge variant="outline">{question.status}</Badge>
			</div>
			<p className="mt-1 text-xs text-muted-foreground">
				Etapa atual: {formatImproveQuestionStageLabel(question.stage)}
			</p>
			{question.warnings[0] ? (
				<p className="mt-2 text-xs text-amber-700">Alerta: {question.warnings[0]}</p>
			) : null}
		</>
	);
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
			<div className="min-h-0 flex-1 overflow-y-auto pr-1">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between gap-2">
						<h2 className="text-sm font-medium">Progresso</h2>
						<Badge variant={status === JOB_STATUS.FAILED ? "destructive" : "secondary"}>
							{status ?? "Carregando"}
						</Badge>
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
									<span className="font-medium text-foreground">
										{metadata[item.key]}
									</span>
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

					<div className="min-h-0 flex-1">
						<div className="mb-2 hidden items-center justify-between md:flex">
							<h3 className="text-sm font-medium">Questões</h3>
							<Badge variant="outline">
								{pendingDraftCount} draft(s) pendente(s)
							</Badge>
						</div>
						<div
							aria-label="Lista de questões no mobile"
							className="min-h-0 flex-1 overflow-hidden md:hidden"
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
									<AccordionContent className="min-h-0 flex-1 border-t px-3 py-3">
										<div className="flex h-full min-h-0 flex-col overflow-y-auto">
											<Accordion type="multiple" className="flex flex-col gap-2">
												{monitor.questions.map((question) => (
													<AccordionItem
														key={question.questionId}
														value={question.questionId}
														className="rounded-md border bg-muted/20"
													>
														<AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
															<p className="min-w-0 flex-1 text-left font-medium">
																Questão {question.questionNumber}
															</p>
														</AccordionTrigger>
														<AccordionContent className="border-t px-3 py-2 text-sm">
															<ImproveQuestionListItem question={question} />
														</AccordionContent>
													</AccordionItem>
												))}
											</Accordion>
										</div>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</div>
						<div
							aria-label="Lista de questões no desktop"
							className="hidden min-h-0 flex-1 overflow-y-auto md:block"
						>
							<ul className="flex flex-col gap-2">
								{monitor.questions.map((question) => (
									<li
										key={question.questionId}
										className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
									>
										<ImproveQuestionListItem question={question} />
									</li>
								))}
							</ul>
						</div>
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
