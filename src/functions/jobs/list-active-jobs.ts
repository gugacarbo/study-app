import { createDb } from "@/db/client";
import type { JobRow } from "@/db/queries/jobs";
import { listActiveJobsForUser } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import {
	type GenerateExamPhase,
	type IngestPhase,
	JOB_KIND,
	JOB_STATUS,
	type JobKind,
	type JobStatus,
	parseGenerateExamJobMetadata,
	parseIngestJobMetadata,
} from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export type ActiveJobSummary = {
	id: string;
	kind: JobKind;
	status: JobStatus;
	phase: IngestPhase | GenerateExamPhase | null;
	metadata: { fileName?: string; examId?: string };
};

function toActiveJobSummary(job: JobRow): ActiveJobSummary {
	const ingestMetadata =
		job.kind === JOB_KIND.INGEST ? parseIngestJobMetadata(job.metadata) : null;

	const generateExamMetadata =
		job.kind === JOB_KIND.GENERATE_EXAM
			? parseGenerateExamJobMetadata(job.metadata)
			: null;

	const phase =
		job.kind === JOB_KIND.INGEST &&
		job.status !== JOB_STATUS.AWAITING_UPLOAD &&
		job.phase
			? (job.phase as IngestPhase)
			: job.kind === JOB_KIND.GENERATE_EXAM &&
					job.status !== JOB_STATUS.AWAITING_UPLOAD &&
					job.phase
				? (job.phase as GenerateExamPhase)
				: null;

	return {
		id: job.id,
		kind: job.kind as JobKind,
		status: job.status as JobStatus,
		phase,
		metadata: {
			...(ingestMetadata?.fileName
				? { fileName: ingestMetadata.fileName }
				: {}),
			...(generateExamMetadata?.examId
				? { examId: generateExamMetadata.examId }
				: {}),
		},
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
