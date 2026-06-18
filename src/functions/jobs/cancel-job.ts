import { createDb } from "@/db/client";
import { getJobById, requestJobCancelIfActive } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import { requireSession } from "@/lib/rbac";

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

	const result = await requestJobCancelIfActive(db, job);
	return Response.json({ ok: true, alreadyTerminal: result.alreadyTerminal });
}
