import type { D1Database } from "@cloudflare/workers-types";

type ServerFnContext = {
	context?: {
		DB?: D1Database;
		env?: {
			DB?: D1Database;
		};
		cloudflare?: {
			env?: {
				DB?: D1Database;
			};
		};
	};
};

type CloudflareWorkersModule = {
	env?: {
		DB?: D1Database;
	};
};

let cachedWorkersEnv: CloudflareWorkersModule["env"] | null | undefined;
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

async function getDBFromCloudflareWorkersModule(): Promise<
	D1Database | undefined
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

	return cachedWorkersEnv?.DB;
}

export async function getDB(
	ctx?: ServerFnContext,
): Promise<D1Database | undefined> {
	const fromServerContext = ctx?.context?.cloudflare?.env?.DB;
	if (fromServerContext) return fromServerContext;

	const fromContextEnv = ctx?.context?.env?.DB;
	if (fromContextEnv) return fromContextEnv;

	const fromContext = ctx?.context?.DB;
	if (fromContext) return fromContext;

	const fromCloudflareWorkersModule = await getDBFromCloudflareWorkersModule();
	if (fromCloudflareWorkersModule) return fromCloudflareWorkersModule;

	const cf = (globalThis as { cloudflare?: { env?: { DB?: D1Database } } })
		.cloudflare;
	return cf?.env?.DB;
}
