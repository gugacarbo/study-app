import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { createImproveQuestionsJob } from "@/features/exams/lib/improve-questions-api";

export function useImproveQuestionsJob() {
	const navigate = useNavigate();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = useCallback(
		async (input: { examId: string; questionIds: string[] }) => {
			setIsPending(true);
			setError(null);
			try {
				const { jobId } = await createImproveQuestionsJob(input);
				await navigate({
					to: "/jobs/$jobId",
					params: { jobId },
				});
			} catch (jobError) {
				setError(
					jobError instanceof Error
						? jobError.message
						: "Não foi possível iniciar a melhoria.",
				);
			} finally {
				setIsPending(false);
			}
		},
		[navigate],
	);

	return {
		submit,
		isPending,
		error,
	};
}
