import {
	buildIngestPhasePart,
	buildIngestTextPart,
	serializeIngestDataPart,
	serializeIngestJobEventPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import {
	type INGEST_PHASE,
	type IngestJobMetadata,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import { PHASE_TEXT } from "./constants";
import type { BackgroundJobRow, RunIngestContext } from "./types";

export async function failJob(
	ctx: RunIngestContext,
	_job: BackgroundJobRow,
	error: string,
	metadata: IngestJobMetadata | null,
): Promise<void> {
	const base = metadata ?? {
		examId: "",
		modelId: "",
		mode: "create" as const,
	};
	await ctx.deps.updateJobStatus(ctx.jobId, {
		status: JOB_STATUS.FAILED,
		error,
		metadata: serializeIngestJobMetadata(base),
	});
}

export async function cancelJob(ctx: RunIngestContext): Promise<void> {
	await ctx.deps.updateJobStatus(ctx.jobId, {
		status: JOB_STATUS.CANCELLED,
		error: null,
	});
}

export async function emitPhase(
	ctx: RunIngestContext,
	phase: (typeof INGEST_PHASE)[keyof typeof INGEST_PHASE],
): Promise<void> {
	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestDataPart(buildIngestPhasePart(phase)),
	);
	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestJobEventPart(buildIngestTextPart(PHASE_TEXT[phase])),
	);
}
