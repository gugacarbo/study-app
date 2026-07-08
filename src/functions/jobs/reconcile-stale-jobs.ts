import type { Queue } from "@cloudflare/workers-types";
import { inArray } from "drizzle-orm";
import {
	appendJobEvent,
	deriveJobProcessing,
	getJobByIdInternal,
	markJobRecoveredAsQueued,
	type JobRow,
	updateJobStatus,
} from "@/db/queries/jobs";
import type { AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import type { JobQueueMessage } from "@/functions/queue";
import {
	IMPROVE_BATCH_PHASE,
	JOB_KIND,
	JOB_STATUS,
	parseImproveQuestionsJobMetadata,
	serializeImproveQuestionsJobMetadata,
	type ImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";
import {
	JOB_PROCESSING_STATE,
	JOB_RECOVERY_MAX_ATTEMPTS,
} from "@/lib/job-processing";

export type ReconcileAction = "requeued" | "cancelled" | "failed" | "noop";

export async function reconcileStaleJobs(
	db: AppDatabase,
	input: {
		queue: Queue<JobQueueMessage>;
		now?: Date;
	},
) {
	const rows = await db
		.select()
		.from(schema.backgroundJobs)
		.where(
			inArray(schema.backgroundJobs.status, [
				JOB_STATUS.QUEUED,
				JOB_STATUS.RUNNING,
			]),
		);

	console.log("[reconcile] jobs scanned", { total: rows.length });

	let requeued = 0;
	let cancelled = 0;
	let failed = 0;
	let noop = 0;

	for (const job of rows) {
		const action = await reconcileSingleJob(db, job, input);
		if (action === "requeued") requeued += 1;
		if (action === "cancelled") cancelled += 1;
		if (action === "failed") failed += 1;
		if (action === "noop") noop += 1;
	}

	console.log("[reconcile] summary", { requeued, cancelled, failed, noop });

	return { requeued, cancelled, failed };
}

export async function reconcileSingleJob(
	db: AppDatabase,
	job: JobRow,
	input: {
		queue: Queue<JobQueueMessage>;
		now?: Date;
	},
): Promise<ReconcileAction> {
	const now = input.now ?? new Date();
	const processing = deriveJobProcessing(job, now);

	const logCtx = {
		jobId: job.id,
		kind: job.kind,
		status: job.status,
		state: processing.state,
		heartbeatAt: job.heartbeatAt,
		leaseExpiresAt: job.leaseExpiresAt,
		cancelRequestedAt: job.cancelRequestedAt,
		recoveryAttempts: job.recoveryAttempts,
	};

	if (processing.state === JOB_PROCESSING_STATE.STALE_QUEUED) {
		if (job.recoveryAttempts >= JOB_RECOVERY_MAX_ATTEMPTS) {
			console.log("[reconcile] stale-queued → failed (recovery exhausted)", logCtx);
			await updateJobStatus(db, job.id, {
				status: JOB_STATUS.FAILED,
				error: "job_dispatch_stalled",
			});
			return "failed";
		}

		console.log("[reconcile] stale-queued → requeued", logCtx);
		await markJobRecoveredAsQueued(db, job.id, {
			phase: job.phase,
			metadata: job.metadata,
		});
		await appendJobEvent(db, job.id, {
			type: "system",
			text: "Dispatch do job não avançou; tentando novamente.",
		});
		await input.queue.send({ jobId: job.id });
		return "requeued";
	}

	if (processing.state !== JOB_PROCESSING_STATE.STALE_RUNNING) {
		console.log("[reconcile] skipped (not stale)", logCtx);
		return "noop";
	}

	if (job.cancelRequestedAt != null) {
		console.log("[reconcile] stale-running + cancel requested → cancelled", logCtx);
		await updateJobStatus(db, job.id, {
			status: JOB_STATUS.CANCELLED,
			error: null,
		});
		await appendJobEvent(db, job.id, {
			type: "system",
			text: "Cancelamento concluído após detectar worker inativo.",
		});
		return "cancelled";
	}

	if (job.recoveryAttempts >= JOB_RECOVERY_MAX_ATTEMPTS) {
		console.log("[reconcile] stale-running → failed (recovery exhausted)", logCtx);
		await updateJobStatus(db, job.id, {
			status: JOB_STATUS.FAILED,
			error: "job_recovery_exhausted",
		});
		return "failed";
	}

	if (
		job.kind === JOB_KIND.INGEST ||
		job.kind === JOB_KIND.GENERATE_EXAM
	) {
		console.log("[reconcile] stale-running → requeued (kind: ingest/generate-exam)", logCtx);
		await markJobRecoveredAsQueued(db, job.id, {
			phase: null,
			metadata: job.metadata,
		});
		await appendJobEvent(db, job.id, {
			type: "system",
			text: "Worker inativo detectado; reiniciando o processamento.",
		});
		await input.queue.send({ jobId: job.id });
		return "requeued";
	}

	if (job.kind === JOB_KIND.IMPROVE_QUESTIONS) {
		const metadata = normalizeImproveQuestionsRecovery(job.metadata);
		if (!metadata) {
			console.log("[reconcile] stale-running → failed (improve-questions metadata invalid)", logCtx);
			await updateJobStatus(db, job.id, {
				status: JOB_STATUS.FAILED,
				error: "job_kind_not_recoverable",
			});
			return "failed";
		}
		console.log("[reconcile] stale-running → requeued (kind: improve-questions)", logCtx);
		await markJobRecoveredAsQueued(db, job.id, {
			phase: metadata.completedCount > 0
				? IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS
				: IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS,
			metadata,
		});
		await appendJobEvent(db, job.id, {
			type: "system",
			text: "Worker inativo detectado; retomando o lote de questões.",
		});
		await input.queue.send({ jobId: job.id });
		return "requeued";
	}

	console.log("[reconcile] stale-running → failed (kind not recoverable)", logCtx);
	await updateJobStatus(db, job.id, {
		status: JOB_STATUS.FAILED,
		error: "job_kind_not_recoverable",
	});
	return "failed";
}

export async function recoverStaleJob(
	db: AppDatabase,
	input: {
		jobId: string;
		queue: Queue<JobQueueMessage>;
		now?: Date;
	},
): Promise<Exclude<ReconcileAction, "noop">> {
	const job = await getJobByIdInternal(db, input.jobId);
	if (!job) {
		throw new Response("Not Found", { status: 404 });
	}

	const processing = deriveJobProcessing(job, input.now ?? new Date());
	if (
		processing.state !== JOB_PROCESSING_STATE.STALE_QUEUED &&
		processing.state !== JOB_PROCESSING_STATE.STALE_RUNNING
	) {
		throw new Response("Conflict", { status: 409 });
	}

	const action = await reconcileSingleJob(db, job, input);
	if (action === "noop") {
		throw new Response("Conflict", { status: 409 });
	}
	return action;
}

function normalizeImproveQuestionsRecovery(
	raw: string | null,
): ImproveQuestionsJobMetadata | null {
	const metadata = parseImproveQuestionsJobMetadata(raw);
	if (!metadata) return null;

	let recoveredItems = 0;
	const items = metadata.items.map((item) => {
		if (item.status !== "running") return { ...item };
		recoveredItems += 1;
		return {
			...item,
			status: "queued" as const,
			error: undefined,
		};
	});

	return JSON.parse(
		serializeImproveQuestionsJobMetadata({
			...metadata,
			queuedCount: metadata.queuedCount + recoveredItems,
			runningCount: Math.max(0, metadata.runningCount - recoveredItems),
			items,
		}),
	) as ImproveQuestionsJobMetadata;
}
