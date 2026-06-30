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
	if (event.cron === JOB_RECOVERY_CRON && env.JOB_QUEUE) {
		await reconcileStaleJobs(createDb(env.DB), {
			queue: env.JOB_QUEUE,
		});
		return;
	}

	await purgeExpiredBlobs(env);
}
