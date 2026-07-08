import { MAX_UPLOAD_BYTES } from "@/lib/ingest-limits";
import { isJobErrorCode, type JobErrorBody } from "@/lib/job-errors";

export type GenerateExamDifficulty = "easy" | "medium" | "hard";

export type CreateGenerateExamJobInput = {
	title: string;
	questionCount: number;
	difficulty: GenerateExamDifficulty;
	difficultyNotes?: string;
};

export type UploadGenerateExamJobInput = {
	mainContent: string;
	contextFiles: File[];
};

function formatJobErrorBody(body: JobErrorBody): string {
	if (isJobErrorCode(body.error)) {
		if (body.error === "file_too_large") {
			if (body.maxChars != null) {
				return `Conteudo excede o limite de ${body.maxChars.toLocaleString("pt-BR")} caracteres.`;
			}
			const maxBytes = body.maxBytes ?? MAX_UPLOAD_BYTES;
			return `Upload excede o limite de ${Math.round(maxBytes / 1024)} KB.`;
		}
		if (body.message) {
			return body.message;
		}
		return body.error;
	}
	return body.error ?? "Erro desconhecido";
}

async function parseGenerateExamApiError(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as JobErrorBody;
		return formatJobErrorBody(body);
	} catch {
		// ignore JSON parse errors
	}

	return `Erro HTTP ${response.status}`;
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

export async function createGenerateExamJob(
	input: CreateGenerateExamJobInput,
): Promise<{ jobId: string; examId: string }> {
	const response = await fetch("/api/jobs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kind: "generate-exam",
			title: input.title,
			questionCount: input.questionCount,
			difficulty: input.difficulty,
			difficultyNotes: input.difficultyNotes,
		}),
	});

	if (!response.ok) {
		throw new Error(await parseGenerateExamApiError(response));
	}

	return response.json() as Promise<{ jobId: string; examId: string }>;
}

export function uploadGenerateExamJobContentWithProgress(
	jobId: string,
	input: UploadGenerateExamJobInput,
	onProgress: (percent: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();

		formData.set("mainContent", input.mainContent);
		for (const file of input.contextFiles) {
			formData.append("contextFiles", file);
		}

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
			reject(new Error("Falha na rede ao enviar o conteudo."));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("Upload cancelado."));
		});

		xhr.open("POST", `/api/jobs/${jobId}/upload`);
		xhr.send(formData);
	});
}
