import { createDb } from "@/db/client";
import type { JobRow } from "@/db/queries/jobs";
import { listActiveJobsForUser } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import {
	JOB_KIND,
	JOB_STATUS,
	type IngestPhase,
	type JobKind,
	type JobStatus,
	parseIngestJobMetadata,
} from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export type ActiveJobSummary = {
	id: string;
	kind: JobKind;
	status: JobStatus;
	phase: IngestPhase | null;
	metadata: { fileName?: string };
};

function toActiveJobSummary(job: JobRow): ActiveJobSummary {
	const ingestMetadata =
		job.kind === JOB_KIND.INGEST
			? parseIngestJobMetadata(job.metadata)
			: null;

	const phase =
		job.kind === JOB_KIND.INGEST &&
		job.status !== JOB_STATUS.AWAITING_UPLOAD &&
		job.phase
			? (job.phase as IngestPhase)
			: null;

	return {
		id: job.id,
		kind: job.kind as JobKind,
		status: job.status as JobStatus,
		phase,
		metadata: ingestMetadata?.fileName
			? { fileName: ingestMetadata.fileName }
			: {},
	};
}

export async function listActiveJobsHandler(headers: Headers) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const jobs = await listActiveJobsForUser(db, session.user.id);

	return Response.json({
		jobs: jobs.map(toActiveJobSummary),
	});
}
