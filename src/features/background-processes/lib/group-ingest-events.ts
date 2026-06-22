import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import { PHASE_LABELS } from "@/features/background-processes/lib/ingest-event-labels";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import {
	INGEST_PHASE,
	JOB_STATUS,
	type IngestPhase,
	type JobStatus,
} from "@/lib/job-kinds";

export const INITIALIZATION_GROUP_LABEL = "Inicialização" as const;

export type IngestEventGroup = {
	label: string;
	phase: IngestPhase | null;
	events: JobEventRecord[];
};

export type IngestGroupStatus = "done" | "active" | "pending" | "failed";

const PHASE_ORDER: (IngestPhase | null)[] = [
	null,
	INGEST_PHASE.READING_FILE,
	INGEST_PHASE.EXTRACTING,
	INGEST_PHASE.PERSISTING,
];

function isPhaseEvent(
	payload: unknown,
): payload is { type: typeof INGEST_DATA_PART.PHASE; data: { phase: IngestPhase } } {
	return (
		!!payload &&
		typeof payload === "object" &&
		"type" in payload &&
		(payload as { type: string }).type === INGEST_DATA_PART.PHASE &&
		"data" in payload &&
		typeof (payload as { data: unknown }).data === "object" &&
		(payload as { data: { phase?: unknown } }).data?.phase != null
	);
}

function groupLabelForPhase(phase: IngestPhase | null): string {
	if (phase === null) return INITIALIZATION_GROUP_LABEL;
	return PHASE_LABELS[phase];
}

function phaseRank(phase: IngestPhase | null): number {
	return PHASE_ORDER.indexOf(phase);
}

function appendToGroup(
	groups: IngestEventGroup[],
	label: string,
	phase: IngestPhase | null,
	event: JobEventRecord,
): void {
	const last = groups.at(-1);
	if (last && last.label === label && last.phase === phase) {
		last.events.push(event);
		return;
	}
	groups.push({ label, phase, events: [event] });
}

export function groupEventsByPhase(events: JobEventRecord[]): IngestEventGroup[] {
	const groups: IngestEventGroup[] = [];
	let currentPhase: IngestPhase | null = null;

	for (const event of events) {
		const label = groupLabelForPhase(currentPhase);
		appendToGroup(groups, label, currentPhase, event);

		if (isPhaseEvent(event.payload)) {
			currentPhase = event.payload.data.phase;
		}
	}

	return groups;
}

function resolveActivePhaseRank(
	status: JobStatus | null,
	phase: string | null,
): number {
	if (status === JOB_STATUS.COMPLETED) {
		return PHASE_ORDER.length;
	}

	if (status === JOB_STATUS.FAILED || status === JOB_STATUS.CANCELLED) {
		const failedPhase = phase as IngestPhase | null;
		return failedPhase ? phaseRank(failedPhase) : 0;
	}

	if (!phase) {
		return 0;
	}

	return phaseRank(phase as IngestPhase);
}

export function getIngestGroupStatus(
	group: IngestEventGroup,
	status: JobStatus | null,
	phase: string | null,
): IngestGroupStatus {
	if (status === JOB_STATUS.FAILED || status === JOB_STATUS.CANCELLED) {
		const failedRank = resolveActivePhaseRank(status, phase);
		const groupRank = phaseRank(group.phase);

		if (groupRank === failedRank) return "failed";
		if (groupRank < failedRank) return "done";
		return "pending";
	}

	if (status === JOB_STATUS.COMPLETED) {
		return "done";
	}

	const activeRank = resolveActivePhaseRank(status, phase);
	const groupRank = phaseRank(group.phase);

	if (groupRank < activeRank) return "done";
	if (groupRank === activeRank) {
		if (
			status === JOB_STATUS.RUNNING ||
			status === JOB_STATUS.QUEUED ||
			status === JOB_STATUS.AWAITING_UPLOAD
		) {
			return "active";
		}
	}
	return "pending";
}

export function isIngestGroupExpanded(groupStatus: IngestGroupStatus): boolean {
	return groupStatus === "active" || groupStatus === "failed";
}
