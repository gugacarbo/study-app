import type { R2Bucket } from "@cloudflare/workers-types";

type ServerFnContext = {
	context?: {
		env?: {
			FILES_BUCKET?: R2Bucket;
			MEMORY_BUCKET?: R2Bucket;
		};
		cloudflare?: {
			env?: {
				FILES_BUCKET?: R2Bucket;
				MEMORY_BUCKET?: R2Bucket;
			};
		};
		FILES_BUCKET?: R2Bucket;
		MEMORY_BUCKET?: R2Bucket;
	};
};

type CloudflareWorkersModule = {
	env?: {
		FILES_BUCKET?: R2Bucket;
		MEMORY_BUCKET?: R2Bucket;
	};
};

let cachedWorkersEnv: CloudflareWorkersModule["env"] | null | undefined;
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

async function getBucketFromCloudflareWorkersModule(): Promise<
	CloudflareWorkersModule["env"]
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

	return cachedWorkersEnv ?? undefined;
}

type BucketBinding = "FILES_BUCKET" | "MEMORY_BUCKET";

async function getBucket(
	binding: BucketBinding,
	ctx?: ServerFnContext,
): Promise<R2Bucket | undefined> {
	const fromServerContext = ctx?.context?.cloudflare?.env?.[binding];
	if (fromServerContext) return fromServerContext;

	const fromContextEnv = ctx?.context?.env?.[binding];
	if (fromContextEnv) return fromContextEnv;

	const fromContext = ctx?.context?.[binding];
	if (fromContext) return fromContext;

	const fromCloudflareWorkersModule = (await getBucketFromCloudflareWorkersModule())?.[
		binding
	];
	if (fromCloudflareWorkersModule) return fromCloudflareWorkersModule;

	const fromGlobalBucket = (
		globalThis as Partial<Record<BucketBinding, R2Bucket>>
	)[binding];
	if (fromGlobalBucket) return fromGlobalBucket;

	const cf = (
		globalThis as {
			cloudflare?: {
				env?: {
					FILES_BUCKET?: R2Bucket;
					MEMORY_BUCKET?: R2Bucket;
				};
			};
		}
	).cloudflare;
	return cf?.env?.[binding];
}

export async function getFilesBucket(
	ctx?: ServerFnContext,
): Promise<R2Bucket | undefined> {
	return getBucket("FILES_BUCKET", ctx);
}

export async function getMemoryBucket(
	ctx?: ServerFnContext,
): Promise<R2Bucket | undefined> {
	return getBucket("MEMORY_BUCKET", ctx);
}
