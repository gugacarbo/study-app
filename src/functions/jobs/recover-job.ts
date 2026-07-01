import { createDb } from "@/db/client";
import { getJobById } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { requireJobQueue } from "@/functions/queue";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import {
	JOB_PROCESSING_STATE,
	deriveJobProcessing,
} from "@/lib/job-processing";
import { recoverStaleJob } from "@/functions/jobs/reconcile-stale-jobs";
import { requireSession } from "@/lib/rbac";

export async function recoverStaleJobHandler(
	jobId: string,
	headers: Headers,
	options?: { now?: Date },
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const queue = await requireJobQueue();

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}

	const processing = deriveJobProcessing(job, options?.now);
	if (
		processing.state !== JOB_PROCESSING_STATE.STALE_QUEUED &&
		processing.state !== JOB_PROCESSING_STATE.STALE_RUNNING
	) {
		return Response.json(
			{ error: "job_not_stale", state: processing.state },
			{ status: 409 },
		);
	}

	const action = await recoverStaleJob(db, { jobId, queue, now: options?.now });
	return Response.json({ ok: true, action, state: processing.state });
}
