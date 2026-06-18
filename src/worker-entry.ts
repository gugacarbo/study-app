import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import startWorker from "@tanstack/react-start/server-entry";
import { handleScheduled } from "./workers/cron";

type WorkerEnv = {
	DB: D1Database;
	FILES_BUCKET: R2Bucket;
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
	scheduled: (
		event: ScheduledEvent,
		env: WorkerEnv,
		ctx: ExecutionContext,
	) => handleScheduled(event, env, ctx),
};
