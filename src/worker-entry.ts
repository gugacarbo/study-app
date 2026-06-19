import type { D1Database, Queue, R2Bucket } from "@cloudflare/workers-types";
import startHandler, {
	createServerEntry,
	type ServerEntry,
} from "@tanstack/react-start/server-entry";
import type { JobQueueMessage } from "./functions/queue";
import { handleScheduled } from "./workers/cron";
import { handleJobConsumer } from "./workers/job-consumer";

type WorkerEnv = {
	DB: D1Database;
	FILES_BUCKET: R2Bucket;
	MEMORY_BUCKET?: R2Bucket;
	JOB_QUEUE?: Queue<JobQueueMessage>;
};

type StartFetch = (
	request: Request,
	opts?: { context?: unknown },
) => Response | Promise<Response>;

function resolveHandlerFetch(): StartFetch {
	const candidate =
		typeof startHandler === "function"
			? (startHandler as StartFetch)
			: ((startHandler as { fetch?: StartFetch }).fetch ??
				(startHandler as { default?: { fetch?: StartFetch } }).default?.fetch);

	if (!candidate) {
		throw new Error("TanStack Start server entry does not export fetch handler");
	}

	return candidate;
}

const handlerFetch = resolveHandlerFetch();

function isWorkerEnv(value: unknown): value is WorkerEnv {
	return (
		typeof value === "object" &&
		value !== null &&
		"DB" in value &&
		!("context" in value)
	);
}

const serverEntry = createServerEntry({
	fetch: (async (
		request: Request,
		envOrOpts?: WorkerEnv | { context?: unknown },
		ctx?: ExecutionContext,
	) => {
		if (isWorkerEnv(envOrOpts)) {
			return handlerFetch(request, {
				context: {
					cloudflare: { env: envOrOpts, ctx },
				},
			});
		}

		return handlerFetch(request, envOrOpts);
	}) as ServerEntry["fetch"],
});

export default {
	fetch: serverEntry.fetch,
	scheduled: (event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) =>
		handleScheduled(event, env, ctx),
	queue: (
		batch: MessageBatch<JobQueueMessage>,
		env: WorkerEnv,
		ctx: ExecutionContext,
	) => handleJobConsumer(batch, env, ctx),
};
