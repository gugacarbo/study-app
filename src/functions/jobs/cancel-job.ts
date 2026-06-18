import { createDb } from "@/db/client";
import { getJobById, setCancelRequested } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { JOB_STATUS } from "@/lib/job-kinds";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import { requireSession } from "@/lib/rbac";

const CANCELLABLE_STATUSES = new Set<string>([
	JOB_STATUS.AWAITING_UPLOAD,
	JOB_STATUS.QUEUED,
	JOB_STATUS.RUNNING,
]);

export async function cancelJobHandler(
	jobId: string,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}

	if (!CANCELLABLE_STATUSES.has(job.status)) {
		return Response.json({ ok: true, alreadyTerminal: true });
	}

	await setCancelRequested(db, jobId);
	return Response.json({ ok: true });
}
