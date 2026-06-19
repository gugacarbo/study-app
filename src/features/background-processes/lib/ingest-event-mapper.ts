import {
	INGEST_DATA_PART,
	type IngestDataPart,
	type IngestPhasePart,
	type IngestSkippedDuplicatePart,
	type IngestStreamProgressPart,
	type IngestSummaryPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import { INGEST_PHASE, type IngestPhase } from "@/lib/job-kinds";

export type MappedAssistantMessage = {
	id: string;
	role: "assistant";
	content: string;
	seq: number;
};

export type ProgressTimelineEntry = {
	seq: number;
	label: string;
	createdAt: string | null;
};

export type IngestProgressState = {
	phase: IngestPhase | null;
	questionsSeen: number;
	extracted: number | null;
	persisted: number | null;
	skippedDuplicate: number | null;
	invalid: number | null;
	timeline: ProgressTimelineEntry[];
};

export const INITIAL_INGEST_PROGRESS: IngestProgressState = {
	phase: null,
	questionsSeen: 0,
	extracted: null,
	persisted: null,
	skippedDuplicate: null,
	invalid: null,
	timeline: [],
};

const PHASE_LABELS: Record<IngestPhase, string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo arquivo",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões",
	[INGEST_PHASE.PERSISTING]: "Salvando questões",
};

function isIngestDataPart(payload: unknown): payload is IngestDataPart {
	if (!payload || typeof payload !== "object" || !("type" in payload)) {
		return false;
	}
	const type = (payload as { type: string }).type;
	return (
		type === INGEST_DATA_PART.PHASE ||
		type === INGEST_DATA_PART.STREAM_PROGRESS ||
		type === INGEST_DATA_PART.SKIPPED_DUPLICATE ||
		type === INGEST_DATA_PART.SUMMARY
	);
}

function isTextPart(
	payload: unknown,
): payload is { type: "text"; text: string } {
	return (
		!!payload &&
		typeof payload === "object" &&
		"type" in payload &&
		(payload as { type: string }).type === "text" &&
		"text" in payload &&
		typeof (payload as { text: unknown }).text === "string"
	);
}

function messageForPhasePart(part: IngestPhasePart): string {
	return `${PHASE_LABELS[part.data.phase]}…`;
}

function messageForProgressPart(part: IngestStreamProgressPart): string {
	const count = part.data.questionsSeen;
	if (count === 1) return "Identifiquei 1 questão até agora…";
	return `Identifiquei ${count} questões até agora…`;
}

function messageForSkippedPart(part: IngestSkippedDuplicatePart): string {
	return `Duplicata ignorada: "${part.data.questionPreview}"`;
}

function messageForSummaryPart(part: IngestSummaryPart): string {
	const { persisted, skippedDuplicate, invalid } = part.data;
	const parts = [`${persisted} questão(ões) salva(s)`];
	if (skippedDuplicate > 0) {
		parts.push(`${skippedDuplicate} duplicata(s) ignorada(s)`);
	}
	if (invalid > 0) {
		parts.push(`${invalid} inválida(s)`);
	}
	return `Importação concluída: ${parts.join(", ")}.`;
}

function timelineLabelForPayload(payload: unknown): string | null {
	if (isTextPart(payload)) return payload.text;
	if (!isIngestDataPart(payload)) return null;

	switch (payload.type) {
		case INGEST_DATA_PART.PHASE:
			return messageForPhasePart(payload);
		case INGEST_DATA_PART.STREAM_PROGRESS:
			return messageForProgressPart(payload);
		case INGEST_DATA_PART.SKIPPED_DUPLICATE:
			return messageForSkippedPart(payload);
		case INGEST_DATA_PART.SUMMARY:
			return messageForSummaryPart(payload);
		default:
			return null;
	}
}

function messageForPayload(payload: unknown): string | null {
	return timelineLabelForPayload(payload);
}

function applyDataPartToProgress(
	progress: IngestProgressState,
	part: IngestDataPart,
): IngestProgressState {
	switch (part.type) {
		case INGEST_DATA_PART.PHASE:
			return { ...progress, phase: part.data.phase };
		case INGEST_DATA_PART.STREAM_PROGRESS:
			return { ...progress, questionsSeen: part.data.questionsSeen };
		case INGEST_DATA_PART.SUMMARY:
			return {
				...progress,
				extracted: part.data.extracted,
				persisted: part.data.persisted,
				skippedDuplicate: part.data.skippedDuplicate,
				invalid: part.data.invalid,
			};
		default:
			return progress;
	}
}

export function mergeJobEvents(
	current: {
		messages: MappedAssistantMessage[];
		progress: IngestProgressState;
		lastSeq: number;
		events: JobEventRecord[];
	},
	incoming: JobEventRecord[],
): {
	messages: MappedAssistantMessage[];
	progress: IngestProgressState;
	lastSeq: number;
	events: JobEventRecord[];
} {
	let { messages, progress, lastSeq, events } = current;

	for (const event of incoming) {
		if (event.seq <= lastSeq) continue;

		events = [...events, event];

		const label = timelineLabelForPayload(event.payload);
		if (label) {
			progress = {
				...progress,
				timeline: [
					...progress.timeline,
					{ seq: event.seq, label, createdAt: event.createdAt },
				].slice(-20),
			};
		}

		const text = messageForPayload(event.payload);
		if (text) {
			messages = [
				...messages,
				{
					id: `job-event-${event.seq}`,
					role: "assistant",
					content: text,
					seq: event.seq,
				},
			];
		}

		if (isIngestDataPart(event.payload)) {
			progress = applyDataPartToProgress(progress, event.payload);
		}

		lastSeq = event.seq;
	}

	return { messages, progress, lastSeq, events };
}

export function formatPhaseLabel(phase: IngestPhase | null): string | null {
	if (!phase) return null;
	return PHASE_LABELS[phase] ?? phase;
}
