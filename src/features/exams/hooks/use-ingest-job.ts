import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
	createIngestJob,
	uploadIngestJobFileWithProgress,
} from "@/features/exams/lib/ingest-api";

export type JobUploadLocationState = { pendingFile?: File };

export type IngestUiState = "idle" | "creating" | "uploading" | "failed";
const MIN_UPLOAD_PROGRESS_MS = 1000;

function wait(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function useIngestJob() {
	const navigate = useNavigate();
	const jobIdRef = useRef<string | null>(null);
	const [uiState, setUiState] = useState<IngestUiState>("idle");
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const submit = useCallback(
		async (input: { file: File }) => {
			setError(null);
			setProgress(0);

			try {
				const jobId =
					jobIdRef.current ??
					(await (async () => {
						setUiState("creating");
						const createdJob = await createIngestJob();
						jobIdRef.current = createdJob.jobId;
						return createdJob.jobId;
					})());

				const uploadStartedAt = Date.now();
				setUiState("uploading");
				await uploadIngestJobFileWithProgress(jobId, input.file, setProgress);
				const remainingMs =
					MIN_UPLOAD_PROGRESS_MS - (Date.now() - uploadStartedAt);
				if (remainingMs > 0) {
					await wait(remainingMs);
				}
				await navigate({
					to: "/jobs/$jobId",
					params: { jobId },
				});
			} catch (createError) {
				setUiState("failed");
				setError(
					createError instanceof Error
						? createError.message
						: "Erro desconhecido",
				);
			}
		},
		[navigate],
	);

	const reset = useCallback(() => {
		setUiState("idle");
		setProgress(0);
		setError(null);
	}, []);

	const isBusy = uiState === "creating" || uiState === "uploading";

	return { uiState, progress, error, submit, reset, isBusy };
}
