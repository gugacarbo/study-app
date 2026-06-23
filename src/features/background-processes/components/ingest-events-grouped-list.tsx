import {
	CheckIcon,
	ChevronDownIcon,
	CircleIcon,
	InfoIcon,
	LoaderCircleIcon,
	XCircleIcon,
} from "lucide-react";
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
	type IngestPhaseGroupItem,
	type IngestGroupStatus,
} from "@/features/background-processes/lib/group-ingest-events";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import type { JobStatus } from "@/lib/job-kinds";
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

function IngestEventRow({ event }: { event: JobEventRecord }) {
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

function IngestSystemSequenceBlock({
	events,
	defaultOpen,
}: {
	events: JobEventRecord[];
	defaultOpen: boolean;
}) {
	const latestEvent = events.at(-1);
	if (!latestEvent) return null;

	const latestLabel = eventLabel(latestEvent);
	const updatesLabel =
		events.length === 1 ? "1 atualização" : `${events.length} atualizações`;

	return (
		<li className="list-none">
			<Collapsible defaultOpen={defaultOpen} className="rounded-xl border bg-muted/40">
				<CollapsibleTrigger
					className={cn(
						"flex w-full items-start gap-3 px-4 py-3 text-left",
						"hover:bg-muted/60 transition-colors",
					)}
				>
					<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
						<InfoIcon className="size-3.5" aria-hidden />
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-foreground">{latestLabel}</p>
						<p className="mt-1 text-xs text-muted-foreground">{updatesLabel}</p>
					</div>
					<ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
				</CollapsibleTrigger>
				<CollapsibleContent className="border-t px-4 pb-3 pt-3">
					<div className="flex flex-col gap-3">
						{events.map((event) => {
							const details = formatEventDetails(event.payload);
							return (
								<div key={event.seq} className="flex gap-3">
									<div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
										<span className="size-1.5 rounded-full bg-current" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm text-foreground">{eventLabel(event)}</p>
										{details.length > 0 ? (
											<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												{details.map((detail) => (
													<span key={`${event.seq}-${detail.label}`}>
														<span className="font-medium">{detail.label}:</span>{" "}
														{detail.value}
													</span>
												))}
											</div>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				</CollapsibleContent>
			</Collapsible>
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
						{group.items.reduce((count, item) => {
							return count + (item.type === "event" ? 1 : item.events.length);
						}, 0)}
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
					{group.items.map((item) => (
						<IngestGroupItemRow key={item.type === "event" ? item.event.seq : item.id} item={item} />
					))}
				</ul>
			</AccordionContent>
		</AccordionItem>
	);
}

function IngestGroupItemRow({ item }: { item: IngestPhaseGroupItem }) {
	if (item.type === "event") {
		return <IngestEventRow event={item.event} />;
	}

	return (
		<IngestSystemSequenceBlock
			events={item.events}
			defaultOpen={item.state === "active"}
		/>
	);
}

function IngestEventsGroupedList({
	events,
	isLoading,
	status,
	phase,
	error,
}: IngestEventsGroupedListProps) {
	const phaseGroups = groupEventsByPhase(events);

	return (
		<div
			aria-label="Eventos do job"
			className="flex min-h-0 flex-1 flex-col gap-3 p-4"
		>
			{isLoading ? (
				<p className="text-xs text-muted-foreground">Atualizando…</p>
			) : null}

			{phaseGroups.length === 0 ? (
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
					]}
					className="flex min-h-0 flex-1 flex-col gap-3"
				>
					{phaseGroups.map((group) => {
						const groupStatus = getIngestGroupStatus(group, status, phase);
						const errorMessage =
							groupStatus === "failed" && error ? error : null;

						return (
							<IngestEventGroupSection
								key={`${group.label}-${group.phase ?? "init"}-${groupStatus}`}
								group={group}
								groupStatus={groupStatus}
								errorMessage={errorMessage}
							/>
						);
					})}
				</Accordion>
			)}
		</div>
	);
}

export { IngestEventsGroupedList };
export default IngestEventsGroupedList;
