import { isJobErrorCode, type JobErrorBody } from "@/lib/job-errors";

async function parseImproveQuestionsApiError(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as JobErrorBody;
		if (isJobErrorCode(body.error)) {
			return body.message ?? body.error;
		}
	} catch {
		// ignore
	}
	return `Erro HTTP ${response.status}`;
}

export async function createImproveQuestionsJob(input: {
	examId: string;
	questionIds: string[];
	concurrencyLimit?: number;
}): Promise<{ jobId: string }> {
	const response = await fetch("/api/jobs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kind: "improve-questions",
			examId: input.examId,
			questionIds: input.questionIds,
			concurrencyLimit: input.concurrencyLimit,
		}),
	});

	if (!response.ok) {
		throw new Error(await parseImproveQuestionsApiError(response));
	}

	return response.json() as Promise<{ jobId: string }>;
}
