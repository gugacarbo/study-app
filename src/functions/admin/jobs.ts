import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	getJobByIdInternal,
	listJobEvents,
	listJobsForAdmin,
	requestJobCancelIfActive,
} from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { requireJobQueue } from "@/functions/queue";
import { recoverStaleJob } from "@/functions/jobs/reconcile-stale-jobs";
import { deriveJobProcessing } from "@/lib/job-processing";
import { type JsonObject, parseJsonObject } from "@/lib/json-value";
import { requireAdminSession } from "@/lib/rbac";

const jobIdSchema = z.object({
	jobId: z.string().uuid(),
});

export type AdminJobDetail = {
	id: string;
	userId: string;
	kind: string;
	status: string;
	phase: string | null;
	error: string | null;
	metadata: JsonObject | null;
	cancelRequestedAt: string | null;
	workerId: string | null;
	processingStartedAt: string | null;
	heartbeatAt: string | null;
	leaseExpiresAt: string | null;
	runAttempts: number;
	recoveryAttempts: number;
	lastRecoveredAt: string | null;
	processingState: string;
	createdAt: string | null;
	updatedAt: string | null;
	events: Array<{
		seq: number;
		payload: JsonObject | null;
		createdAt: string | null;
	}>;
};

export async function listAdminJobsHandler(headers: Headers) {
	await requireAdminSession(headers);
	const db = createDb(await requireDB());
	return listJobsForAdmin(db);
}

export async function getAdminJobDetailHandler(
	jobId: string,
	headers: Headers,
): Promise<AdminJobDetail> {
	await requireAdminSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobByIdInternal(db, jobId);
	if (!job) {
		throw new Response("Not Found", { status: 404 });
	}

	const events = await listJobEvents(db, jobId, 0);

	return {
		id: job.id,
		userId: job.userId,
		kind: job.kind,
		status: job.status,
		phase: job.phase,
		error: job.error,
		metadata: parseJsonObject(job.metadata),
		cancelRequestedAt: job.cancelRequestedAt,
		workerId: job.workerId,
		processingStartedAt: job.processingStartedAt,
		heartbeatAt: job.heartbeatAt,
		leaseExpiresAt: job.leaseExpiresAt,
		runAttempts: job.runAttempts,
		recoveryAttempts: job.recoveryAttempts,
		lastRecoveredAt: job.lastRecoveredAt,
		processingState: deriveJobProcessing(job).state,
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
		events: events.map((event) => ({
			seq: event.seq,
			payload: parseJsonObject(event.payload),
			createdAt: event.createdAt,
		})),
	};
}

export async function cancelAdminJobHandler(jobId: string, headers: Headers) {
	await requireAdminSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobByIdInternal(db, jobId);
	if (!job) {
		throw new Response("Not Found", { status: 404 });
	}

	const result = await requestJobCancelIfActive(db, job);
	return { ok: true as const, alreadyTerminal: result.alreadyTerminal };
}

export async function recoverAdminJobHandler(jobId: string, headers: Headers) {
	await requireAdminSession(headers);
	const db = createDb(await requireDB());
	const queue = await requireJobQueue();

	const action = await recoverStaleJob(db, {
		jobId,
		queue,
	});

	return { ok: true as const, action };
}

export const listAdminJobs = createServerFn({ method: "GET" }).handler(
	async () => listAdminJobsHandler(getRequest().headers),
);

export const getAdminJobDetail = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => jobIdSchema.parse(data))
	.handler(async ({ data }) =>
		getAdminJobDetailHandler(data.jobId, getRequest().headers),
	);

export const cancelAdminJob = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => jobIdSchema.parse(data))
	.handler(async ({ data }) =>
		cancelAdminJobHandler(data.jobId, getRequest().headers),
	);

export const recoverAdminJob = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => jobIdSchema.parse(data))
	.handler(async ({ data }) =>
		recoverAdminJobHandler(data.jobId, getRequest().headers),
	);
