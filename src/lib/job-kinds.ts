export const JOB_KIND = {
	INGEST: "ingest",
	EXPLAIN_QUESTION: "explain-question",
	IMPROVE_QUESTIONS: "improve-questions",
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
	REVIEWING: "reviewing",
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

export type IngestWarning =
	(typeof INGEST_WARNING)[keyof typeof INGEST_WARNING];

/** Statuses that block a second ingest job on the same exam (append). */
export const ACTIVE_INGEST_STATUSES = [
	JOB_STATUS.AWAITING_UPLOAD,
	JOB_STATUS.QUEUED,
	JOB_STATUS.RUNNING,
] as const satisfies readonly JobStatus[];

/** Statuses where cancel_requested_at may be set. */
export const CANCELLABLE_JOB_STATUSES = [
	JOB_STATUS.AWAITING_UPLOAD,
	JOB_STATUS.QUEUED,
	JOB_STATUS.RUNNING,
] as const satisfies readonly JobStatus[];

export function isCancellableJobStatus(status: string): boolean {
	return (CANCELLABLE_JOB_STATUSES as readonly string[]).includes(status);
}

/** Statuses a user may still cancel manually from the UI. */
export const MANUALLY_CANCELLABLE_JOB_STATUSES = [
	...CANCELLABLE_JOB_STATUSES,
	JOB_STATUS.FAILED,
] as const satisfies readonly JobStatus[];

export function canManuallyCancelJobStatus(status: string): boolean {
	return (MANUALLY_CANCELLABLE_JOB_STATUSES as readonly string[]).includes(
		status,
	);
}

export function statusBadgeVariant(
	status: string,
): { variant: "secondary" | "destructive" | "outline"; className: string } {
	switch (status) {
		case JOB_STATUS.COMPLETED:
			return {
				variant: "secondary",
				className:
					"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
			};
		case JOB_STATUS.FAILED:
			return { variant: "destructive", className: "" };
		case JOB_STATUS.CANCELLED:
			return {
				variant: "secondary",
				className:
					"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
			};
		case JOB_STATUS.RUNNING:
			return {
				variant: "secondary",
				className:
					"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
			};
		case JOB_STATUS.QUEUED:
			return {
				variant: "secondary",
				className:
					"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
			};
		case JOB_STATUS.AWAITING_UPLOAD:
			return {
				variant: "secondary",
				className:
					"bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
			};
		default:
			return { variant: "outline", className: "" };
	}
}

export type TokenUsage = {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
};

export type IngestJobMetadata = {
	examId: string;
	modelId: string;
	mode: IngestMode;
	fileId?: string;
	fileName?: string;
	extractedCount?: number;
	reviewedCount?: number;
	persistedCount?: number;
	skippedDuplicateCount?: number;
	invalidCount?: number;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	cost?: number;
	warning?: IngestWarning;
	reviewWarning?: "review_fallback";
};

export const IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY = 2;

export const IMPROVE_BATCH_PHASE = {
	PREPARING_BATCH: "preparing_batch",
	DISPATCHING_AGENTS: "dispatching_agents",
	PROCESSING_QUESTIONS: "processing_questions",
	FINALIZING_BATCH: "finalizing_batch",
} as const;

export type ImproveBatchPhase =
	(typeof IMPROVE_BATCH_PHASE)[keyof typeof IMPROVE_BATCH_PHASE];

export const IMPROVE_QUESTION_STAGE = {
	QUEUED: "queued",
	LOADING_QUESTION: "loading_question",
	RESEARCHING: "researching",
	DRAFTING: "drafting",
	WRITING_EXPLANATIONS: "writing_explanations",
	SAVING_DRAFT: "saving_draft",
} as const;

export type ImproveQuestionStage =
	(typeof IMPROVE_QUESTION_STAGE)[keyof typeof IMPROVE_QUESTION_STAGE];

export type ImproveQuestionItemStatus =
	| "queued"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export type ImproveQuestionItem = {
	questionId: string;
	questionNumber: number;
	status: ImproveQuestionItemStatus;
	stage: ImproveQuestionStage;
	summary?: string;
	error?: string;
};

export type ImproveQuestionsJobMetadata = {
	examId: string;
	modelId: string;
	writeExplanations: boolean;
	writeOptionExplanations: boolean;
	questionIds: string[];
	concurrencyLimit: number;
	totalCount: number;
	queuedCount: number;
	runningCount: number;
	completedCount: number;
	failedCount: number;
	cancelledCount: number;
	pendingReviewCount: number;
	items: ImproveQuestionItem[];
};

export function parseIngestJobMetadata(
	raw: string | null,
): IngestJobMetadata | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as IngestJobMetadata;
	} catch {
		return null;
	}
}

export function serializeIngestJobMetadata(
	metadata: IngestJobMetadata,
): string {
	return JSON.stringify(metadata);
}

export function parseImproveQuestionsJobMetadata(
	raw: string | null,
): ImproveQuestionsJobMetadata | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<ImproveQuestionsJobMetadata>;
		if (
			typeof parsed !== "object" ||
			parsed == null ||
			typeof parsed.examId !== "string" ||
			typeof parsed.modelId !== "string" ||
			(typeof parsed.writeExplanations !== "boolean" &&
				typeof parsed.writeExplanations !== "undefined") ||
			(typeof parsed.writeOptionExplanations !== "boolean" &&
				typeof parsed.writeOptionExplanations !== "undefined") ||
			!Array.isArray(parsed.questionIds) ||
			typeof parsed.concurrencyLimit !== "number" ||
			typeof parsed.totalCount !== "number" ||
			typeof parsed.queuedCount !== "number" ||
			typeof parsed.runningCount !== "number" ||
			typeof parsed.completedCount !== "number" ||
			typeof parsed.failedCount !== "number" ||
			typeof parsed.cancelledCount !== "number" ||
			typeof parsed.pendingReviewCount !== "number" ||
			!Array.isArray(parsed.items)
		) {
			return null;
		}
		return {
			...parsed,
			writeExplanations: parsed.writeExplanations ?? false,
			writeOptionExplanations: parsed.writeOptionExplanations ?? false,
		} as ImproveQuestionsJobMetadata;
	} catch {
		return null;
	}
}

export function serializeImproveQuestionsJobMetadata(
	metadata: ImproveQuestionsJobMetadata,
): string {
	return JSON.stringify(metadata);
}
