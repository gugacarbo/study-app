import { isJobErrorCode, type JobErrorBody } from "@/lib/job-errors";
import type { JobProcessingState } from "@/lib/job-processing";
import type {
	ImproveQuestionsJobMetadata,
	IngestJobMetadata,
	JobStatus,
} from "@/lib/job-kinds";

export const JOB_POLL_INTERVAL_MS = 1500;

export type JobEventRecord = {
	seq: number;
	payload: unknown;
	createdAt: string | null;
};

export type JobEventsResponse = {
	status: JobStatus;
	phase: string | null;
	error: string | null;
	cancelRequestedAt: string | null;
	cancelledAt: string | null;
	processing: {
		state: JobProcessingState;
		heartbeatAt: string | null;
		leaseExpiresAt: string | null;
		recoveryAttempts: number;
	};
	metadata: IngestJobMetadata | ImproveQuestionsJobMetadata | null;
	events: JobEventRecord[];
};

export async function parseJobApiError(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as JobErrorBody;
		if (isJobErrorCode(body.error)) {
			return body.message ?? body.error;
		}
	} catch {
		// ignore JSON parse errors
	}
	return `Erro HTTP ${response.status}`;
}

export async function cancelJob(jobId: string): Promise<void> {
	const response = await fetch(`/api/jobs/${jobId}/cancel`, {
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(await parseJobApiError(response));
	}
}

export async function fetchJobEvents(
	jobId: string,
	afterSeq = 0,
): Promise<JobEventsResponse> {
	const url =
		afterSeq > 0
			? `/api/jobs/${jobId}/events?after=${afterSeq}`
			: `/api/jobs/${jobId}/events`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(await parseJobApiError(response));
	}
	return response.json() as Promise<JobEventsResponse>;
}
