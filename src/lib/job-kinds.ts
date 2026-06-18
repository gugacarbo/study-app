export const JOB_KIND = {
	INGEST: "ingest",
	EXPLAIN_QUESTION: "explain-question",
	CONNECTION_TEST: "connection-test",
	MODEL_BENCHMARK: "model-benchmark",
} as const;

export type JobKind = (typeof JOB_KIND)[keyof typeof JOB_KIND];

export const JOB_STATUS = {
	AWAITING_UPLOAD: "awaiting_upload",
	QUEUED: "queued",
	RUNNING: "running",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const INGEST_PHASE = {
	READING_FILE: "reading_file",
	EXTRACTING: "extracting",
	PERSISTING: "persisting",
} as const;

export type IngestPhase = (typeof INGEST_PHASE)[keyof typeof INGEST_PHASE];

export const INGEST_MODE = {
	CREATE: "create",
	APPEND: "append",
} as const;

export type IngestMode = (typeof INGEST_MODE)[keyof typeof INGEST_MODE];

export const INGEST_WARNING = {
	PARTIAL_EXTRACTION: "partial_extraction",
} as const;

export type IngestWarning = (typeof INGEST_WARNING)[keyof typeof INGEST_WARNING];

/** Statuses that block a second ingest job on the same exam (append). */
export const ACTIVE_INGEST_STATUSES = [
	JOB_STATUS.AWAITING_UPLOAD,
	JOB_STATUS.QUEUED,
	JOB_STATUS.RUNNING,
] as const satisfies readonly JobStatus[];

export type IngestJobMetadata = {
	examId: string;
	modelId: string;
	mode: IngestMode;
	fileId?: string;
	fileName?: string;
	extractedCount?: number;
	persistedCount?: number;
	skippedDuplicateCount?: number;
	invalidCount?: number;
	warning?: IngestWarning;
};

export function parseIngestJobMetadata(raw: string | null): IngestJobMetadata | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as IngestJobMetadata;
	} catch {
		return null;
	}
}

export function serializeIngestJobMetadata(metadata: IngestJobMetadata): string {
	return JSON.stringify(metadata);
}
