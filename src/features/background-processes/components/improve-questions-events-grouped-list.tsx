import {
	CheckIcon,
	CircleIcon,
	LoaderCircleIcon,
	XCircleIcon,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import { JOB_STATUS, type JobStatus } from "@/lib/job-kinds";

type ImproveQuestionsEventsGroupedListProps = {
	monitor: ImproveMonitorState;
	events: JobEventRecord[];
	status: JobStatus | null;
	isLoading: boolean;
	error: string | null;
};

function labelForEvent(event: JobEventRecord): string {
	if (typeof event.payload !== "object" || event.payload == null) {
		return `Evento #${event.seq}`;
	}
	const payload = event.payload as { type?: string; data?: Record<string, unknown> };
	switch (payload.type) {
		case "data-improve-batch-phase":
			return `Fase do lote: ${String(payload.data?.phase ?? "desconhecida")}`;
		case "data-improve-question-stage":
			return `Etapa: ${String(payload.data?.stage ?? "desconhecida")}`;
		case "data-improve-question-status":
			return `Status: ${String(payload.data?.status ?? "desconhecido")}`;
		case "data-improve-question-warning":
			return String(payload.data?.message ?? "Aviso");
		case "text":
			return String((event.payload as { text?: unknown }).text ?? "");
		case "tool-call":
			return `Tool: ${String((event.payload as { toolName?: unknown }).toolName ?? "desconhecida")}`;
		case "tool-result":
			return "Resultado de tool";
		default:
			return payload.type ?? `Evento #${event.seq}`;
	}
}

function GroupIcon({ status }: { status: string }) {
	if (status === "completed") {
		return <CheckIcon className="size-4 text-primary" aria-hidden />;
	}
	if (status === "failed" || status === "cancelled") {
		return <XCircleIcon className="size-4 text-destructive" aria-hidden />;
	}
	if (status === "running") {
		return <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden />;
	}
	return <CircleIcon className="size-4 text-muted-foreground" aria-hidden />;
}

export function ImproveQuestionsEventsGroupedList({
	monitor,
	events,
	status,
	isLoading,
	error,
}: ImproveQuestionsEventsGroupedListProps) {
	const systemEvents = events.filter((event) => {
		if (typeof event.payload !== "object" || event.payload == null) return true;
		return !("questionId" in event.payload) &&
			!(
				"data" in event.payload &&
				typeof (event.payload as { data?: { questionId?: unknown } }).data?.questionId ===
					"string"
			);
	});

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
			{isLoading ? (
				<p className="text-xs text-muted-foreground">Atualizando…</p>
			) : null}

			<Accordion
				type="multiple"
				defaultValue={[
					...monitor.questions
						.filter((question) => question.status === "running" || question.status === "failed")
						.map((question) => question.questionId),
					...(systemEvents.length > 0 ? ["system"] : []),
				]}
				className="flex min-h-0 flex-1 flex-col gap-3"
			>
				{monitor.questions.map((question) => (
					<AccordionItem
						key={question.questionId}
						value={question.questionId}
						className="rounded-md border"
					>
						<AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
							<span className="flex items-center gap-2">
								<GroupIcon status={question.status} />
								<span className="font-medium">Questão {question.questionNumber}</span>
								<Badge variant="secondary">{question.events.length}</Badge>
							</span>
						</AccordionTrigger>
						<AccordionContent className="border-t px-3 pb-3 pt-2">
							{question.error ? (
								<p className="mb-2 text-sm text-destructive">{question.error}</p>
							) : null}
							<ul className="flex flex-col gap-2">
								{question.events.map((event) => (
									<li key={event.seq} className="rounded-md border bg-muted/20 p-3 text-sm">
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<span>#{event.seq}</span>
										</div>
										<p className="mt-1">{labelForEvent(event)}</p>
									</li>
								))}
							</ul>
						</AccordionContent>
					</AccordionItem>
				))}

				{systemEvents.length > 0 ? (
					<AccordionItem value="system" className="rounded-md border">
						<AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
							<span className="flex items-center gap-2">
								<GroupIcon status={status ?? JOB_STATUS.QUEUED} />
								<span className="font-medium">Sistema do lote</span>
								<Badge variant="secondary">{systemEvents.length}</Badge>
							</span>
						</AccordionTrigger>
						<AccordionContent className="border-t px-3 pb-3 pt-2">
							{error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
							<ul className="flex flex-col gap-2">
								{systemEvents.map((event) => (
									<li key={event.seq} className="rounded-md border bg-muted/20 p-3 text-sm">
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<span>#{event.seq}</span>
										</div>
										<p className="mt-1">{labelForEvent(event)}</p>
									</li>
								))}
							</ul>
						</AccordionContent>
					</AccordionItem>
				) : null}
			</Accordion>
		</div>
	);
}
