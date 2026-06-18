import type { Queue } from "@cloudflare/workers-types";

export type JobQueueMessage = {
	jobId: string;
};

type ServerFnContext = {
	context?: {
		env?: {
			JOB_QUEUE?: Queue<JobQueueMessage>;
		};
		cloudflare?: {
			env?: {
				JOB_QUEUE?: Queue<JobQueueMessage>;
			};
		};
		JOB_QUEUE?: Queue<JobQueueMessage>;
	};
};

type CloudflareWorkersModule = {
	env?: {
		JOB_QUEUE?: Queue<JobQueueMessage>;
	};
};

let cachedWorkersEnv: CloudflareWorkersModule["env"] | null | undefined;
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

async function getJobQueueFromCloudflareWorkersModule(): Promise<
	Queue<JobQueueMessage> | undefined
> {
	if (cachedWorkersEnv === undefined) {
		try {
			const mod = (await import(
				/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE
			)) as CloudflareWorkersModule;
			cachedWorkersEnv = mod.env ?? null;
		} catch {
			cachedWorkersEnv = null;
		}
	}

	return cachedWorkersEnv?.JOB_QUEUE;
}

export async function getJobQueue(
	ctx?: ServerFnContext,
): Promise<Queue<JobQueueMessage> | undefined> {
	const fromServerContext = ctx?.context?.cloudflare?.env?.JOB_QUEUE;
	if (fromServerContext) return fromServerContext;

	const fromContextEnv = ctx?.context?.env?.JOB_QUEUE;
	if (fromContextEnv) return fromContextEnv;

	const fromContext = ctx?.context?.JOB_QUEUE;
	if (fromContext) return fromContext;

	const fromCloudflareWorkersModule =
		await getJobQueueFromCloudflareWorkersModule();
	if (fromCloudflareWorkersModule) return fromCloudflareWorkersModule;

	const cf = globalThis as {
		cloudflare?: { env?: { JOB_QUEUE?: Queue<JobQueueMessage> } };
	};
	return cf.cloudflare?.env?.JOB_QUEUE;
}

export async function requireJobQueue(
	ctx?: ServerFnContext,
): Promise<Queue<JobQueueMessage>> {
	const queue = await getJobQueue(ctx);
	if (!queue) {
		throw new Error("JOB_QUEUE binding is not available");
	}
	return queue;
}

export async function enqueueJob(
	jobId: string,
	ctx?: ServerFnContext,
): Promise<void> {
	const queue = await requireJobQueue(ctx);
	await queue.send({ jobId });
}
