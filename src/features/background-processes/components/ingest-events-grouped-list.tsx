import {
	ArrowRightIcon,
	CheckIcon,
	ChevronDownIcon,
	CircleIcon,
	ClipboardCheckIcon,
	DatabaseIcon,
	FileTextIcon,
	InfoIcon,
	LoaderCircleIcon,
	RefreshCwIcon,
	SparklesIcon,
	XCircleIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
	isSystemInfoPart,
	isSystemStatusText,
	isSystemTextPart,
} from "@/features/background-processes/lib/ingest-event-labels";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	formatEventDetails,
	formatEventLabel,
	formatEventType,
} from "@/features/background-processes/lib/ingest-event-mapper";
import {
	getIngestGroupStatus,
	groupEventsByPhase,
	isIngestGroupExpanded,
	type IngestEventGroup,
	type IngestGroupStatus,
} from "@/features/background-processes/lib/group-ingest-events";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import { JOB_STATUS, type JobStatus } from "@/lib/job-kinds";
import { cn } from "@/lib/utils";

type IngestEventsGroupedListProps = {
	events: JobEventRecord[];
	isLoading: boolean;
	status: JobStatus | null;
	phase: string | null;
	error: string | null;
};

function formatEventTimestamp(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("pt-BR");
}

function eventLabel(event: JobEventRecord): string {
	return formatEventLabel(event.payload) ?? `Evento #${event.seq}`;
}

function GroupStatusIcon({ status }: { status: IngestGroupStatus }) {
	switch (status) {
		case "done":
			return <CheckIcon className="size-4 text-primary" aria-hidden />;
		case "active":
			return (
				<LoaderCircleIcon
					className="size-4 animate-spin text-primary"
					aria-hidden
				/>
			);
		case "failed":
			return <XCircleIcon className="size-4 text-destructive" aria-hidden />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" aria-hidden />;
	}
}

type SystemKindVisual = {
	icon: LucideIcon;
	borderClass: string;
	bgClass: string;
	circleClass: string;
	textClass: string;
};

const SYSTEM_KIND_VISUALS: Record<string, SystemKindVisual> = {
	phase: {
		icon: ArrowRightIcon,
		borderClass: "border-l-chart-3",
		bgClass: "bg-chart-3/10",
		circleClass: "bg-chart-3/15",
		textClass: "text-chart-3",
	},
	"file-read": {
		icon: FileTextIcon,
		borderClass: "border-l-chart-2",
		bgClass: "bg-chart-2/10",
		circleClass: "bg-chart-2/15",
		textClass: "text-chart-2",
	},
	"llm-call": {
		icon: SparklesIcon,
		borderClass: "border-l-chart-1",
		bgClass: "bg-chart-1/10",
		circleClass: "bg-chart-1/15",
		textClass: "text-chart-1",
	},
	"llm-retry": {
		icon: RefreshCwIcon,
		borderClass: "border-l-chart-5",
		bgClass: "bg-chart-5/10",
		circleClass: "bg-chart-5/15",
		textClass: "text-chart-5",
	},
	"persist-validating": {
		icon: ClipboardCheckIcon,
		borderClass: "border-l-chart-4",
		bgClass: "bg-chart-4/10",
		circleClass: "bg-chart-4/15",
		textClass: "text-chart-4",
	},
	"persist-progress": {
		icon: DatabaseIcon,
		borderClass: "border-l-chart-3",
		bgClass: "bg-chart-3/10",
		circleClass: "bg-chart-3/15",
		textClass: "text-chart-3",
	},
};

const SYSTEM_KIND_FALLBACK: SystemKindVisual = {
	icon: InfoIcon,
	borderClass: "border-l-muted-foreground",
	bgClass: "bg-muted/50",
	circleClass: "bg-muted-foreground/15",
	textClass: "text-muted-foreground",
};

function IngestSystemMessageRow({ event }: { event: JobEventRecord }) {
	const kind = isSystemInfoPart(event.payload) ? event.payload.data.kind : "";
	const label = eventLabel(event);
	const details = formatEventDetails(event.payload);
	const v = SYSTEM_KIND_VISUALS[kind] ?? SYSTEM_KIND_FALLBACK;

	return (
		<li
			className={`flex items-start gap-3 rounded-md border-l-2 p-3 ${v.borderClass} ${v.bgClass}`}
		>
			<div className={`flex size-6 shrink-0 items-center justify-center rounded-full ${v.circleClass}`}>
				<v.icon className={`size-3.5 ${v.textClass}`} aria-hidden />
			</div>
			<div className="min-w-0 flex-1">
				<p className={`text-sm font-medium ${v.textClass}`}>{label}</p>
				{details.length > 0 ? (
					<div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
						{details.map((detail) => (
							<span key={detail.label}>
								<span className="font-medium">{detail.label}:</span> {detail.value}
							</span>
						))}
					</div>
				) : null}
			</div>
		</li>
	);
}

function dedupeSystemInfoEvents(events: JobEventRecord[]): JobEventRecord[] {
	const seenKinds = new Map<string, number[]>();
	const toRemove = new Set<number>();

	for (const event of events) {
		if (isSystemInfoPart(event.payload)) {
			const kind = event.payload.data.kind;
			if (seenKinds.has(kind)) {
				const prevSeq = seenKinds.get(kind)![0]!;
				toRemove.add(prevSeq);
				seenKinds.set(kind, [event.seq, ...seenKinds.get(kind)!.slice(1)]);
			} else {
				seenKinds.set(kind, [event.seq]);
			}
		}
	}

	return events.filter((e) => !toRemove.has(e.seq));
}

function IngestEventRow({ event }: { event: JobEventRecord }) {
	if (isSystemInfoPart(event.payload)) {
		return <IngestSystemMessageRow event={event} />;
	}

	const details = formatEventDetails(event.payload);
	const hasDetails = details.length > 0;

	return (
		<li className="rounded-md border bg-muted/30 p-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-xs text-muted-foreground">
					#{event.seq}
				</span>
				<span className="text-xs text-muted-foreground">
					{formatEventTimestamp(event.createdAt)}
				</span>
				<Badge variant="outline">{formatEventType(event.payload)}</Badge>
			</div>
			<p className="mt-2 text-sm">{eventLabel(event)}</p>
			{hasDetails ? (
				<Collapsible className="mt-2">
					<CollapsibleTrigger
						className={cn(
							"flex items-center gap-1 text-xs text-muted-foreground",
							"hover:text-foreground",
						)}
					>
						<ChevronDownIcon className="size-3" />
						Detalhes
					</CollapsibleTrigger>
					<CollapsibleContent className="mt-2 flex flex-col gap-1 text-xs">
						{details.map((detail) => (
							<div key={detail.label} className="flex gap-2">
								<span className="text-muted-foreground">{detail.label}:</span>
								<span>{detail.value}</span>
							</div>
						))}
					</CollapsibleContent>
				</Collapsible>
			) : null}
		</li>
	);
}

function IngestEventGroupSection({
	group,
	groupStatus,
	errorMessage,
}: {
	group: IngestEventGroup;
	groupStatus: IngestGroupStatus;
	errorMessage: string | null;
}) {
	return (
		<AccordionItem value={group.label} className="rounded-md border">
			<AccordionTrigger
				className={cn(
					"px-3 py-2 text-sm",
					"hover:no-underline hover:bg-muted/50",
					"[&_svg]:size-4",
				)}
			>
				<span className="flex items-center gap-2">
					<GroupStatusIcon status={groupStatus} />
					<span className="font-medium">{group.label}</span>
					<Badge variant="secondary" className="font-normal">
						{group.events.length}
					</Badge>
				</span>
			</AccordionTrigger>
			<AccordionContent className="max-h-72 overflow-y-auto border-t px-3 pb-3 pt-2">
				{errorMessage ? (
					<p className="mb-2 text-sm text-destructive" role="alert">
						{errorMessage}
					</p>
				) : null}
				<ul className="flex flex-col gap-2">
					{group.events.map((event) => (
						<IngestEventRow key={event.seq} event={event} />
					))}
				</ul>
			</AccordionContent>
		</AccordionItem>
	);
}

const SYSTEM_GROUP_LABEL = "Mensagens do sistema";

function isSystemEvent(event: JobEventRecord): boolean {
	if (isSystemInfoPart(event.payload)) return true;
	if (isSystemTextPart(event.payload) && isSystemStatusText(event.payload.text)) {
		return true;
	}
	return false;
}

function systemGroupStatus(
	hasEvents: boolean,
	jobStatus: JobStatus | null,
): IngestGroupStatus {
	if (!hasEvents) return "pending";
	if (
		jobStatus === JOB_STATUS.COMPLETED ||
		jobStatus === JOB_STATUS.FAILED ||
		jobStatus === JOB_STATUS.CANCELLED
	) {
		return "done";
	}
	return "active";
}

function IngestEventsGroupedList({
	events,
	isLoading,
	status,
	phase,
	error,
}: IngestEventsGroupedListProps) {
	const dedupedEvents = dedupeSystemInfoEvents(events);
	const systemEvents = dedupedEvents.filter(isSystemEvent);
	const regularEvents = dedupedEvents.filter((e) => !isSystemEvent(e));
	const phaseGroups = groupEventsByPhase(regularEvents);
	const sysStatus = systemGroupStatus(systemEvents.length > 0, status);
	const hasSystemGroup = sysStatus !== "pending";
	const allGroupLabels = [
		...phaseGroups.map((g) => g.label),
		...(hasSystemGroup ? [SYSTEM_GROUP_LABEL] : []),
	];

	return (
		<div
			aria-label="Eventos do job"
			className="flex min-h-0 flex-1 flex-col gap-3 p-4"
		>
			{isLoading ? (
				<p className="text-xs text-muted-foreground">Atualizando…</p>
			) : null}

			{allGroupLabels.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{isLoading
						? "Carregando eventos…"
						: "Nenhum evento registrado ainda."}
				</p>
			) : (
				<Accordion
					type="multiple"
					defaultValue={[
						...phaseGroups
							.filter((g) =>
								isIngestGroupExpanded(getIngestGroupStatus(g, status, phase)),
							)
							.map((g) => g.label),
						...(isIngestGroupExpanded(sysStatus)
							? [SYSTEM_GROUP_LABEL]
							: []),
					]}
					className="flex min-h-0 flex-1 flex-col gap-3"
				>
					{phaseGroups.map((group) => {
						const groupStatus = getIngestGroupStatus(group, status, phase);
						const errorMessage =
							groupStatus === "failed" && error ? error : null;

						return (
							<IngestEventGroupSection
								key={`${group.label}-${group.phase ?? "init"}-${groupStatus}-${group.events[0]?.seq ?? 0}`}
								group={group}
								groupStatus={groupStatus}
								errorMessage={errorMessage}
							/>
						);
					})}
					{hasSystemGroup ? (
						<IngestEventGroupSection
							key={`system-${sysStatus}`}
							group={{
								label: SYSTEM_GROUP_LABEL,
								phase: null,
								events: systemEvents,
							}}
							groupStatus={sysStatus}
							errorMessage={null}
						/>
					) : null}
				</Accordion>
			)}
		</div>
	);
}

export { IngestEventsGroupedList };
export default IngestEventsGroupedList;
