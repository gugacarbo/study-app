import { createDb } from "@/db/client";
import { getJobById, listJobEvents } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import { deriveJobProcessing } from "@/lib/job-processing";
import { requireSession } from "@/lib/rbac";

function parseAfterParam(value: string | null): number {
	if (!value) return 0;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return parsed;
}

export async function getJobEventsHandler(
	jobId: string,
	request: Request,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}

	const url = new URL(request.url);
	const afterSeq = parseAfterParam(url.searchParams.get("after"));
	const events = await listJobEvents(db, jobId, afterSeq);

	return Response.json({
		status: job.status,
		phase: job.phase,
		error: job.error,
		cancelRequestedAt: job.cancelRequestedAt,
		cancelledAt: job.cancelledAt,
		processing: deriveJobProcessing(job),
		metadata: job.metadata ? JSON.parse(job.metadata) : null,
		events: events.map((event) => ({
			seq: event.seq,
			payload: JSON.parse(event.payload),
			createdAt: event.createdAt,
		})),
	});
}
