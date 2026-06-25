import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
	createImproveQuestionsJob,
	ImproveQuestionsConflictError,
} from "@/features/exams/lib/improve-questions-api";

export type ImproveQuestionsConflict = {
	message: string;
	jobId: string;
	examId: string;
	reason: "active_job" | "pending_review";
};

export function useImproveQuestionsJob() {
	const navigate = useNavigate();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [conflict, setConflict] = useState<ImproveQuestionsConflict | null>(
		null,
	);

	const submit = useCallback(
		async (input: {
			examId: string;
			questionIds: string[];
			writeExplanations?: boolean;
		}) => {
			setIsPending(true);
			setError(null);
			setConflict(null);
			try {
				const { jobId } = await createImproveQuestionsJob(input);
				await navigate({
					to: "/jobs/$jobId",
					params: { jobId },
				});
				return true;
			} catch (jobError) {
				if (jobError instanceof ImproveQuestionsConflictError) {
					setConflict({
						message: jobError.message,
						jobId: jobError.jobId,
						examId: jobError.examId,
						reason: jobError.reason,
					});
					return false;
				}
				setError(
					jobError instanceof Error
						? jobError.message
						: "Não foi possível iniciar a melhoria.",
				);
				return false;
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
		conflict,
	};
}
