import { createDb } from "@/db/client";
import { getJobById, updateJobStatus } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { enqueueJob } from "@/functions/queue";
import {
	retryAllFailedItems,
	retryImproveQuestionItem,
} from "@/features/ai/jobs/improve-questions/metadata";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import {
	JOB_KIND,
	JOB_STATUS,
	parseImproveQuestionsJobMetadata,
	serializeImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export async function retryQuestionHandler(
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
	if (
		job.status !== JOB_STATUS.RUNNING &&
		job.status !== JOB_STATUS.QUEUED &&
		job.status !== JOB_STATUS.FAILED &&
		job.status !== JOB_STATUS.COMPLETED
	) {
		return Response.json(
			{ error: "job_not_retryable", status: job.status },
			{ status: 409 },
		);
	}

	const metadata = parseImproveQuestionsJobMetadata(job.metadata);
	if (!metadata) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404, {
			message: "invalid_improve_questions_metadata",
		});
	}

	const validateResult = retryImproveQuestionItem(metadata, questionId);
	if (!validateResult.ok) {
		return Response.json(
			{ error: validateResult.reason, questionId },
			{ status: 409 },
		);
	}

	const updatedMetadata = retryAllFailedItems(validateResult.metadata);

	const nextStatus =
		job.status === JOB_STATUS.RUNNING || job.status === JOB_STATUS.QUEUED
			? job.status
			: JOB_STATUS.QUEUED;

	await updateJobStatus(db, jobId, {
		status: nextStatus,
		metadata: serializeImproveQuestionsJobMetadata(updatedMetadata),
	});

	if (nextStatus === JOB_STATUS.QUEUED) {
		await enqueueJob(jobId);
	}

	return Response.json({ ok: true });
}
