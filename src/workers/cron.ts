import {
	type PurgeBindings,
	purgeExpiredBlobs,
} from "@/functions/storage/purge-expired-blobs";
import { createDb } from "@/db/client";
import { reconcileStaleJobs } from "@/functions/jobs/reconcile-stale-jobs";
import { JOB_RECOVERY_CRON } from "@/lib/job-processing";
import type { JobQueueMessage } from "@/functions/queue";
import type { D1Database, Queue } from "@cloudflare/workers-types";

type ScheduledBindings = PurgeBindings & {
	DB: D1Database;
	JOB_QUEUE?: Queue<JobQueueMessage>;
};

export async function handleScheduled(
	event: ScheduledEvent,
	env: ScheduledBindings,
	_ctx: ExecutionContext,
) {
	console.log("[cron] received trigger", {
		cron: event.cron || "(empty)",
		scheduledTime: event.scheduledTime,
	});

	if (event.cron === JOB_RECOVERY_CRON) {
		if (!env.JOB_QUEUE) {
			console.warn(
				"[cron] JOB_QUEUE binding missing; skipping stale job reconciliation",
			);
			return;
		}

		console.log("[cron] starting job recovery reconcile", {
			cron: event.cron,
			scheduledTime: event.scheduledTime,
		});

		try {
			const result = await reconcileStaleJobs(createDb(env.DB), {
				queue: env.JOB_QUEUE,
			});
			console.log("[cron] job recovery reconcile finished", result);
		} catch (error) {
			console.error("[cron] job recovery reconcile failed", error);
		}
		return;
	}

	console.log("[cron] starting blob purge", {
		cron: event.cron,
		scheduledTime: event.scheduledTime,
	});

	try {
		await purgeExpiredBlobs(env);
		console.log("[cron] blob purge finished");
	} catch (error) {
		console.error("[cron] blob purge failed", error);
	}
}
