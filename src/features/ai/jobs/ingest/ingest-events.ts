import type { IngestPhase } from "@/lib/job-kinds";

export const INGEST_DATA_PART = {
	PHASE: "data-ingest-phase",
	STREAM_PROGRESS: "data-ingest-stream-progress",
	SKIPPED_DUPLICATE: "data-ingest-skipped-duplicate",
	SUMMARY: "data-ingest-summary",
	PERSIST_PROGRESS: "data-ingest-persist-progress",
	SYSTEM_INFO: "data-ingest-system-info",
} as const;

export type IngestPhasePart = {
	type: typeof INGEST_DATA_PART.PHASE;
	data: { phase: IngestPhase };
};

export type IngestStreamProgressPart = {
	type: typeof INGEST_DATA_PART.STREAM_PROGRESS;
	data: { questionsSeen: number };
};

export type IngestSkippedDuplicatePart = {
	type: typeof INGEST_DATA_PART.SKIPPED_DUPLICATE;
	data: { questionPreview: string };
};

export type IngestSummaryPart = {
	type: typeof INGEST_DATA_PART.SUMMARY;
	data: {
		extracted: number;
		persisted: number;
		skippedDuplicate: number;
		invalid: number;
	};
};

export type IngestPersistProgressPart = {
	type: typeof INGEST_DATA_PART.PERSIST_PROGRESS;
	data: { saved: number; total: number };
};

export type IngestTextPart = {
	type: "text";
	text: string;
};

export type IngestJobEventPart = IngestDataPart | IngestTextPart;

export type IngestSystemInfoKind =
	| "phase"
	| "file-read"
	| "llm-call"
	| "llm-retry"
	| "persist-validating"
	| "persist-progress"
	| "cancel-requested"
	| "cancelled";

export type IngestSystemInfoPart = {
	type: typeof INGEST_DATA_PART.SYSTEM_INFO;
	data: {
		kind: IngestSystemInfoKind;
		payload: Record<string, unknown>;
	};
};

export type IngestDataPart =
	| IngestPhasePart
	| IngestStreamProgressPart
	| IngestSkippedDuplicatePart
	| IngestSummaryPart
	| IngestPersistProgressPart
	| IngestSystemInfoPart;

export function buildIngestPhasePart(phase: IngestPhase): IngestPhasePart {
	return {
		type: INGEST_DATA_PART.PHASE,
		data: { phase },
	};
}

export function buildIngestStreamProgressPart(
	questionsSeen: number,
): IngestStreamProgressPart {
	return {
		type: INGEST_DATA_PART.STREAM_PROGRESS,
		data: { questionsSeen },
	};
}

export function buildIngestSkippedDuplicatePart(
	questionText: string,
): IngestSkippedDuplicatePart {
	return {
		type: INGEST_DATA_PART.SKIPPED_DUPLICATE,
		data: { questionPreview: questionText.slice(0, 80) },
	};
}

export function buildIngestSummaryPart(input: {
	extracted: number;
	persisted: number;
	skippedDuplicate: number;
	invalid: number;
}): IngestSummaryPart {
	return {
		type: INGEST_DATA_PART.SUMMARY,
		data: input,
	};
}

export function buildIngestPersistProgressPart(
	saved: number,
	total: number,
): IngestPersistProgressPart {
	return {
		type: INGEST_DATA_PART.PERSIST_PROGRESS,
		data: { saved, total },
	};
}

function formatIngestCount(value: number): string {
	return value.toLocaleString("pt-BR");
}

export function buildIngestFileReadText(charCount: number): string {
	return `Arquivo lido: ${formatIngestCount(charCount)} caracteres`;
}

export function buildIngestLlmCallText(): string {
	return "Chamando modelo para extração…";
}

export function buildIngestLlmRetryText(
	attempt: number,
	maxAttempts: number,
): string {
	return `Tentativa ${attempt}/${maxAttempts}…`;
}

export function buildIngestPersistValidatingText(total: number): string {
	return `Validando ${total} questão(ões)…`;
}

export function buildIngestPhaseSystemInfo(
	phase: IngestPhase,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "phase", payload: { phase } },
	};
}

export function buildIngestFileReadSystemInfo(
	charCount: number,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "file-read", payload: { charCount } },
	};
}

export function buildIngestLlmCallSystemInfo(): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "llm-call", payload: {} },
	};
}

export function buildIngestLlmRetrySystemInfo(
	attempt: number,
	maxAttempts: number,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "llm-retry", payload: { attempt, maxAttempts } },
	};
}

export function buildIngestPersistValidatingSystemInfo(
	total: number,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "persist-validating", payload: { total } },
	};
}

export function buildIngestPersistProgressSystemInfo(
	saved: number,
	total: number,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "persist-progress", payload: { saved, total } },
	};
}

export function buildIngestCancelRequestedSystemInfo(
	at: string,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "cancel-requested", payload: { at } },
	};
}

export function buildIngestCancelledSystemInfo(
	at: string,
): IngestSystemInfoPart {
	return {
		type: INGEST_DATA_PART.SYSTEM_INFO,
		data: { kind: "cancelled", payload: { at } },
	};
}

export function serializeIngestDataPart(part: IngestDataPart): string {
	return JSON.stringify(part);
}

export function buildIngestTextPart(text: string): IngestTextPart {
	return { type: "text", text };
}

export function serializeIngestJobEventPart(part: IngestJobEventPart): string {
	return JSON.stringify(part);
}
