import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { createIngestJob } from "@/features/exams/lib/ingest-api";

export type JobUploadLocationState = { pendingFile?: File };

export type IngestUiState = "idle" | "creating" | "failed";

export function useIngestJob() {
	const navigate = useNavigate();
	const [uiState, setUiState] = useState<IngestUiState>("idle");
	const [error, setError] = useState<string | null>(null);

	const submit = useCallback(
		async (input: { file: File }) => {
			setUiState("creating");
			setError(null);

			try {
				const { jobId } = await createIngestJob();
				await navigate({
					to: "/jobs/$jobId",
					params: { jobId },
					state: { pendingFile: input.file },
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
		setError(null);
	}, []);

	const isBusy = uiState === "creating";

	return { uiState, error, submit, reset, isBusy };
}
