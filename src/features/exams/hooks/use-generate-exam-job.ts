import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
	type CreateGenerateExamJobInput,
	createGenerateExamJob,
	type UploadGenerateExamJobInput,
	uploadGenerateExamJobContentWithProgress,
} from "@/features/exams/lib/generate-exam-api";

export type GenerateExamUiState = "idle" | "creating" | "uploading" | "failed";

const MIN_UPLOAD_PROGRESS_MS = 1000;

function wait(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function useGenerateExamJob() {
	const navigate = useNavigate();
	const [uiState, setUiState] = useState<GenerateExamUiState>("idle");
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const submit = useCallback(
		async (input: CreateGenerateExamJobInput & UploadGenerateExamJobInput) => {
			setError(null);
			setProgress(0);

			try {
				setUiState("creating");
				const createdJob = await createGenerateExamJob({
					title: input.title,
					questionCount: input.questionCount,
					difficulty: input.difficulty,
					difficultyNotes: input.difficultyNotes,
				});
				const jobId = createdJob.jobId;

				const uploadStartedAt = Date.now();
				setUiState("uploading");
				await uploadGenerateExamJobContentWithProgress(
					jobId,
					{
						mainContent: input.mainContent,
						contextFiles: input.contextFiles,
					},
					setProgress,
				);

				const remainingMs =
					MIN_UPLOAD_PROGRESS_MS - (Date.now() - uploadStartedAt);
				if (remainingMs > 0) {
					await wait(remainingMs);
				}

				await navigate({
					to: "/jobs/$jobId",
					params: { jobId },
				});
			} catch (jobError) {
				setUiState("failed");
				setError(
					jobError instanceof Error ? jobError.message : "Erro desconhecido",
				);
				return false;
			}

			return true;
		},
		[navigate],
	);

	const reset = useCallback(() => {
		setUiState("idle");
		setProgress(0);
		setError(null);
	}, []);

	const isBusy = uiState === "creating" || uiState === "uploading";

	return {
		uiState,
		progress,
		error,
		isBusy,
		submit,
		reset,
	};
}
