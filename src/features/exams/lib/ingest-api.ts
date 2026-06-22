import { MAX_UPLOAD_BYTES } from "@/lib/ingest-limits";
import { isJobErrorCode, type JobErrorBody } from "@/lib/job-errors";
import type { IngestJobMetadata, JobStatus } from "@/lib/job-kinds";

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
		return formatJobErrorBody(body);
	} catch {
		// ignore JSON parse errors
	}
	return `Erro HTTP ${response.status}`;
}

function formatJobErrorBody(body: JobErrorBody): string {
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
	return body.error ?? "Erro desconhecido";
}

function parseXhrErrorBody(
	status: number,
	responseText: string,
): Promise<string> {
	try {
		const body = JSON.parse(responseText) as JobErrorBody;
		return Promise.resolve(formatJobErrorBody(body));
	} catch {
		return Promise.resolve(`Erro HTTP ${status}`);
	}
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

export function uploadIngestJobFileWithProgress(
	jobId: string,
	file: File,
	onProgress: (percent: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();
		formData.set("file", file);

		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable && event.total > 0) {
				onProgress(Math.round((event.loaded / event.total) * 100));
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				onProgress(100);
				resolve();
				return;
			}
			void parseXhrErrorBody(xhr.status, xhr.responseText).then((message) => {
				reject(new Error(message));
			});
		});

		xhr.addEventListener("error", () => {
			reject(new Error("Falha na rede ao enviar o arquivo."));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("Upload cancelado."));
		});

		xhr.open("POST", `/api/jobs/${jobId}/upload`);
		xhr.send(formData);
	});
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
