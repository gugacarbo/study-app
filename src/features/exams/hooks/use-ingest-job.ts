import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
	createIngestJob,
	uploadIngestJobFile,
} from "@/features/exams/lib/ingest-api";

export type IngestUiState = "idle" | "uploading" | "failed";

export function useIngestJob() {
	const navigate = useNavigate();
	const [uiState, setUiState] = useState<IngestUiState>("idle");
	const [error, setError] = useState<string | null>(null);

	const submit = useCallback(
		async (input: { file: File }) => {
			setUiState("uploading");
			setError(null);

			try {
				const { jobId } = await createIngestJob();
				await uploadIngestJobFile(jobId, input.file);
				await navigate({ to: "/jobs/$jobId", params: { jobId } });
			} catch (uploadError) {
				setUiState("failed");
				setError(
					uploadError instanceof Error
						? uploadError.message
						: "Erro desconhecido",
				);
			}
		},
		[navigate],
	);

	const reset = useCallback(() => {
		setUiState("idle");
		setError(null);
	}, []);

	const isBusy = uiState === "uploading";

	return { uiState, error, submit, reset, isBusy };
}
