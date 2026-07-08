import { createDb } from "@/db/client";
import { getJobById, updateJobStatus } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { cancelImproveQuestionItem } from "@/features/ai/jobs/improve-questions/metadata";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import { JOB_KIND, JOB_STATUS, parseImproveQuestionsJobMetadata, serializeImproveQuestionsJobMetadata } from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export async function cancelQuestionHandler(
	jobId: string,
	questionId: string,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}
	if (job.kind !== JOB_KIND.IMPROVE_QUESTIONS) {
		return jobErrorResponse(JOB_ERROR_CODE.INVALID_JOB_KIND, 400);
	}
	if (job.status !== JOB_STATUS.RUNNING && job.status !== JOB_STATUS.QUEUED) {
		return Response.json(
			{ error: "job_not_active", status: job.status },
			{ status: 409 },
		);
	}

	const metadata = parseImproveQuestionsJobMetadata(job.metadata);
	if (!metadata) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404, {
			message: "invalid_improve_questions_metadata",
		});
	}

	const result = cancelImproveQuestionItem(metadata, questionId);
	if (!result.ok) {
		return Response.json(
			{ error: result.reason, questionId },
			{ status: 409 },
		);
	}

	await updateJobStatus(db, jobId, {
		metadata: serializeImproveQuestionsJobMetadata(result.metadata),
	});

	return Response.json({ ok: true, item: result.item });
}
