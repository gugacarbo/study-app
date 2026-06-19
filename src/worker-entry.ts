import type { D1Database, Queue, R2Bucket } from "@cloudflare/workers-types";
import startWorker from "@tanstack/react-start/server-entry";
import type { JobQueueMessage } from "./functions/queue";
import { handleScheduled } from "./workers/cron";
import { handleJobConsumer } from "./workers/job-consumer";

type WorkerEnv = {
	DB: D1Database;
	FILES_BUCKET: R2Bucket;
	MEMORY_BUCKET?: R2Bucket;
	JOB_QUEUE?: Queue<JobQueueMessage>;
};

type FetchHandler = (
	request: Request,
	env: WorkerEnv,
	ctx: ExecutionContext,
) => Response | Promise<Response>;

const fetchHandler =
	typeof startWorker === "function"
		? (startWorker as FetchHandler)
		: ((startWorker as { fetch?: FetchHandler }).fetch ??
			(startWorker as { default?: FetchHandler }).default);

if (!fetchHandler) {
	throw new Error("TanStack Start server entry does not export fetch handler");
}

export default {
	fetch: fetchHandler,
	scheduled: (event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) =>
		handleScheduled(event, env, ctx),
	queue: (
		batch: MessageBatch<JobQueueMessage>,
		env: WorkerEnv,
		ctx: ExecutionContext,
	) => handleJobConsumer(batch, env, ctx),
};
