import type { IngestPhase } from "@/lib/job-kinds";

export const INGEST_DATA_PART = {
	PHASE: "data-ingest-phase",
	STREAM_PROGRESS: "data-ingest-stream-progress",
	SKIPPED_DUPLICATE: "data-ingest-skipped-duplicate",
	SUMMARY: "data-ingest-summary",
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

export type IngestDataPart =
	| IngestPhasePart
	| IngestStreamProgressPart
	| IngestSkippedDuplicatePart
	| IngestSummaryPart;

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

export function serializeIngestDataPart(part: IngestDataPart): string {
	return JSON.stringify(part);
}
