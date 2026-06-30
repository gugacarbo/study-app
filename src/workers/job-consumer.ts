import type {
	D1Database,
	MessageBatch,
	R2Bucket,
} from "@cloudflare/workers-types";
import { createDb } from "@/db/client";
import { claimQueuedJobForProcessing } from "@/db/queries/jobs";
import { runJobConsumer } from "@/features/ai/jobs/run-job-consumer";
import type { JobQueueMessage } from "@/functions/queue";

export type JobConsumerBindings = {
	DB: D1Database;
	FILES_BUCKET: R2Bucket;
	MEMORY_BUCKET?: R2Bucket;
	TAVILY_API_KEY?: string;
};

export async function handleJobConsumer(
	batch: MessageBatch<JobQueueMessage>,
	env: JobConsumerBindings,
	_ctx: ExecutionContext,
): Promise<void> {
	const db = createDb(env.DB);

	console.log("[job-consumer] handling batch", batch.messages.length);

	for (const message of batch.messages) {
		console.log("[job-consumer] handling message", message.id);
		try {
			const { jobId } = message.body;
			if (!jobId) {
				console.warn("[job-consumer] missing jobId in message", message.id);
				message.ack();
				continue;
			}

			const workerId = `job-worker:${message.id}:${crypto.randomUUID()}`;
			const job = await claimQueuedJobForProcessing(db, jobId, workerId);
			if (!job) {
				console.log("[job-consumer] skipping message", message.id);
				message.ack();
				continue;
			}

			await runJobConsumer({ db, env, job });
			message.ack();
		} catch (error) {
			console.error("[job-consumer] failed", message.id, error);
			message.retry();
		}
	}
}
