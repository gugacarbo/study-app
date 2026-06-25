import { MAX_TEXT_CHARS, MAX_UPLOAD_BYTES } from "@/lib/ingest-limits";

export const JOB_ERROR_CODE = {
	NO_VALID_QUESTIONS: "no_valid_questions",
	MODEL_UNAVAILABLE: "model_unavailable",
	EXAM_NOT_FOUND: "exam_not_found",
	EMPTY_FILE: "empty_file",
	FILE_TOO_LARGE: "file_too_large",
	TEXT_TOO_LONG: "text_too_long",
	INVALID_FILE_TYPE: "invalid_file_type",
	ACTIVE_JOB_CONFLICT: "active_job_conflict",
	JOB_NOT_FOUND: "job_not_found",
	JOB_NOT_AWAITING_UPLOAD: "job_not_awaiting_upload",
	INVALID_JOB_KIND: "invalid_job_kind",
} as const;

export type JobErrorCode = (typeof JOB_ERROR_CODE)[keyof typeof JOB_ERROR_CODE];

export type JobErrorBody = {
	error: JobErrorCode;
	message?: string;
	maxBytes?: number;
	maxChars?: number;
	jobId?: string;
	examId?: string;
	reason?: "active_job" | "pending_review";
};

export function jobError(
	code: JobErrorCode,
	extra?: Omit<JobErrorBody, "error">,
): JobErrorBody {
	return { error: code, ...extra };
}

export function jobErrorResponse(
	code: JobErrorCode,
	status: number,
	extra?: Omit<JobErrorBody, "error">,
): Response {
	return Response.json(jobError(code, extra), { status });
}

export function isJobErrorCode(value: string): value is JobErrorCode {
	return Object.values(JOB_ERROR_CODE).includes(value as JobErrorCode);
}

export const JOB_ERROR_DEFAULTS = {
	[JOB_ERROR_CODE.FILE_TOO_LARGE]: { maxBytes: MAX_UPLOAD_BYTES },
	[JOB_ERROR_CODE.TEXT_TOO_LONG]: { maxChars: MAX_TEXT_CHARS },
} as const satisfies Partial<Record<JobErrorCode, Omit<JobErrorBody, "error">>>;

export function fileTooLargeResponse(): Response {
	return jobErrorResponse(JOB_ERROR_CODE.FILE_TOO_LARGE, 413, {
		maxBytes: MAX_UPLOAD_BYTES,
	});
}

export function textTooLongResponse(): Response {
	return jobErrorResponse(JOB_ERROR_CODE.TEXT_TOO_LONG, 413, {
		maxChars: MAX_TEXT_CHARS,
	});
}
