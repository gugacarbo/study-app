import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import {
	isSystemInfoPart,
	isSystemStatusText,
	isSystemTextPart,
	PHASE_LABELS,
} from "@/features/background-processes/lib/ingest-event-labels";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import {
	INGEST_PHASE,
	JOB_STATUS,
	type IngestPhase,
	type JobStatus,
} from "@/lib/job-kinds";

export const INITIALIZATION_GROUP_LABEL = "Inicialização" as const;

export type IngestSystemGroupState = "active" | "closed-history";

export type IngestPhaseGroupItem =
	| {
			type: "event";
			event: JobEventRecord;
	  }
	| {
			type: "system-group";
			id: string;
			events: JobEventRecord[];
			state: IngestSystemGroupState;
	  };

export type IngestEventGroup = {
	label: string;
	phase: IngestPhase | null;
	items: IngestPhaseGroupItem[];
};

export type IngestGroupStatus = "done" | "active" | "pending" | "failed";

const PHASE_ORDER: (IngestPhase | null)[] = [
	null,
	INGEST_PHASE.READING_FILE,
	INGEST_PHASE.EXTRACTING,
	INGEST_PHASE.REVIEWING,
	INGEST_PHASE.PERSISTING,
];

function resolvePhaseFromPayload(
	payload: unknown,
): IngestPhase | null {
	if (!payload || typeof payload !== "object") return null;

	// INGEST_DATA_PART.PHASE type
	if (
		"type" in payload &&
		(payload as { type: string }).type === INGEST_DATA_PART.PHASE &&
		"data" in payload &&
		typeof (payload as { data: unknown }).data === "object" &&
		(payload as { data: { phase?: unknown } }).data?.phase != null
	) {
		return (payload as { data: { phase: IngestPhase } }).data.phase;
	}

	// System-info "phase" kind
	if (
		isSystemInfoPart(payload) &&
		payload.data.kind === "phase" &&
		payload.data.payload?.phase != null
	) {
		return payload.data.payload.phase as IngestPhase;
	}

	return null;
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
): IngestEventGroup {
	const last = groups.at(-1);
	if (last && last.label === label && last.phase === phase) {
		return last;
	}
	const group = { label, phase, items: [] as IngestPhaseGroupItem[] };
	groups.push(group);
	return group;
}

export function isSystemEvent(event: JobEventRecord): boolean {
	if (isSystemInfoPart(event.payload)) return true;
	if (isSystemTextPart(event.payload) && isSystemStatusText(event.payload.text)) {
		return true;
	}
	return false;
}

function closeActiveSystemGroup(group: IngestEventGroup | null): void {
	const lastItem = group?.items.at(-1);
	if (lastItem?.type === "system-group" && lastItem.state === "active") {
		lastItem.state = "closed-history";
	}
}

function appendPhaseEvent(
	group: IngestEventGroup,
	event: JobEventRecord,
): void {
	group.items.push({ type: "event", event });
}

function appendSystemEvent(
	group: IngestEventGroup,
	event: JobEventRecord,
): void {
	const lastItem = group.items.at(-1);
	if (lastItem?.type === "system-group" && lastItem.state === "active") {
		lastItem.events.push(event);
		return;
	}
	group.items.push({
		type: "system-group",
		id: `${group.label}-system-${event.seq}`,
		events: [event],
		state: "active",
	});
}

export function groupEventsByPhase(events: JobEventRecord[]): IngestEventGroup[] {
	const groups: IngestEventGroup[] = [];
	let currentPhase: IngestPhase | null = null;
	let currentGroup: IngestEventGroup | null = null;

	for (const event of events) {
		const label = groupLabelForPhase(currentPhase);
		currentGroup = appendToGroup(groups, label, currentPhase);
		if (isSystemEvent(event)) {
			appendSystemEvent(currentGroup, event);
		} else {
			closeActiveSystemGroup(currentGroup);
			appendPhaseEvent(currentGroup, event);
		}

		const phase = resolvePhaseFromPayload(event.payload);
		if (phase !== null) {
			closeActiveSystemGroup(currentGroup);
			currentPhase = phase;
			currentGroup = null;
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
