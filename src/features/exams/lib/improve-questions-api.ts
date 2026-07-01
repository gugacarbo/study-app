import { isJobErrorCode, type JobErrorBody } from "@/lib/job-errors";

export class ImproveQuestionsConflictError extends Error {
	readonly jobId: string;
	readonly examId: string;
	readonly reason: "active_job" | "pending_review";

	constructor(input: {
		message: string;
		jobId: string;
		examId: string;
		reason: "active_job" | "pending_review";
	}) {
		super(input.message);
		this.name = "ImproveQuestionsConflictError";
		this.jobId = input.jobId;
		this.examId = input.examId;
		this.reason = input.reason;
	}
}

async function parseImproveQuestionsApiError(
	response: Response,
): Promise<Error> {
	try {
		const body = (await response.json()) as JobErrorBody;
		if (isJobErrorCode(body.error)) {
			if (
				body.error === "active_job_conflict" &&
				typeof body.jobId === "string" &&
				typeof body.examId === "string" &&
				(body.reason === "active_job" || body.reason === "pending_review")
			) {
				return new ImproveQuestionsConflictError({
					message:
						body.message ??
						(body.reason === "pending_review"
							? "Já existe um processo de melhoria pendente de aprovação para esta prova."
							: "Já existe um processo de melhoria em andamento para esta prova."),
					jobId: body.jobId,
					examId: body.examId,
					reason: body.reason,
				});
			}
			return new Error(body.message ?? body.error);
		}
	} catch {
		// ignore
	}
	return new Error(`Erro HTTP ${response.status}`);
}

export async function createImproveQuestionsJob(input: {
	examId: string;
	questionIds: string[];
	concurrencyLimit?: number;
	writeExplanations?: boolean;
	writeOptionExplanations?: boolean;
}): Promise<{ jobId: string }> {
	const response = await fetch("/api/jobs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kind: "improve-questions",
			examId: input.examId,
			questionIds: input.questionIds,
			concurrencyLimit: input.concurrencyLimit,
			writeExplanations: input.writeExplanations,
			writeOptionExplanations: input.writeOptionExplanations,
		}),
	});

	if (!response.ok) {
		throw await parseImproveQuestionsApiError(response);
	}

	return response.json() as Promise<{ jobId: string }>;
}
