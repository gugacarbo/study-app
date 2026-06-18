import { type JobErrorBody, isJobErrorCode } from "@/lib/job-errors";
import type { IngestJobMetadata, JobStatus } from "@/lib/job-kinds";
import { MAX_UPLOAD_BYTES } from "@/lib/ingest-limits";

export const INGEST_POLL_INTERVAL_MS = 1500;

export type JobEventsResponse = {
	status: JobStatus;
	phase: string | null;
	error: string | null;
	metadata: IngestJobMetadata | null;
};

export async function parseIngestApiError(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as JobErrorBody;
		if (isJobErrorCode(body.error)) {
			if (body.error === "file_too_large") {
				if (body.maxChars != null) {
					return `Arquivo excede o limite de ${body.maxChars.toLocaleString("pt-BR")} caracteres.`;
				}
				const maxBytes = body.maxBytes ?? MAX_UPLOAD_BYTES;
				return `Arquivo excede o limite de ${Math.round(maxBytes / 1024)} KB.`;
			}
			if (body.message) return body.message;
			return body.error;
		}
	} catch {
		// ignore JSON parse errors
	}
	return `Erro HTTP ${response.status}`;
}

export async function createIngestJob(): Promise<{
	jobId: string;
	examId: string;
}> {
	const response = await fetch("/api/jobs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ kind: "ingest" }),
	});
	if (!response.ok) {
		throw new Error(await parseIngestApiError(response));
	}
	return response.json() as Promise<{ jobId: string; examId: string }>;
}

export async function uploadIngestJobFile(
	jobId: string,
	file: File,
): Promise<void> {
	const formData = new FormData();
	formData.set("file", file);

	const response = await fetch(`/api/jobs/${jobId}/upload`, {
		method: "POST",
		body: formData,
	});
	if (!response.ok) {
		throw new Error(await parseIngestApiError(response));
	}
}

export async function fetchIngestJobEvents(
	jobId: string,
): Promise<JobEventsResponse> {
	const response = await fetch(`/api/jobs/${jobId}/events`);
	if (!response.ok) {
		throw new Error(await parseIngestApiError(response));
	}
	return response.json() as Promise<JobEventsResponse>;
}
