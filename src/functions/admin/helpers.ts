import type { AppDatabase } from "@/db/client";
import { createDb } from "@/db/client";
import * as aiModels from "@/db/queries/ai-models";
import { getByIdForUser as getProviderByIdForUser } from "@/db/queries/ai-providers";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	deleteConfigValue,
	getConfigValue,
} from "@/db/queries/config";
import { requireDB } from "@/functions/db";
import { decryptSecret, encryptSecret } from "@/lib/config-encryption";
import { requireAdminSession } from "@/lib/rbac";

export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

export async function getAdminDb(headers: Headers) {
	const session = await requireAdminSession(headers);
	return { session, db: createDb(await requireDB()) };
}

export async function clearDefaultIfModelId(
	db: AppDatabase,
	userId: string,
	modelId: string,
) {
	const defaultId = await getConfigValue(
		db,
		userId,
		CONFIG_KEY_DEFAULT_AI_MODEL,
	);
	if (defaultId === modelId) {
		await deleteConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL);
	}
}

export type ProviderProbeSuccess = {
	ok: true;
	statusCode: number;
	latencyMs: number;
	models: string[];
};

export type ProviderProbeFailure = {
	ok: false;
	statusCode?: number;
	latencyMs: number;
	error: string;
};

export async function probeProvider(
	baseUrl: string,
	apiKey: string,
): Promise<ProviderProbeSuccess | ProviderProbeFailure> {
	const start = Date.now();
	try {
		const root = normalizeBaseUrl(baseUrl);
		const url = new URL("models", `${root}/`);
		const response = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		const latencyMs = Date.now() - start;
		if (!response.ok) {
			return {
				ok: false,
				statusCode: response.status,
				latencyMs,
				error: `HTTP ${response.status}`,
			};
		}
		const body = (await response.json()) as OpenAiModelsResponse;
		const models = (body.data ?? [])
			.map((item) => item.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);
		return { ok: true, statusCode: response.status, latencyMs, models };
	} catch (error) {
		const latencyMs = Date.now() - start;
		const message =
			error instanceof Error ? error.message : "Connection failed";
		return { ok: false, latencyMs, error: message };
	}
}

type OpenAiModelsResponse = {
	data?: Array<{ id?: string }>;
};

export async function fetchOpenAiModelIds(
	baseUrl: string,
	apiKey: string,
): Promise<string[]> {
	const root = normalizeBaseUrl(baseUrl);
	const url = new URL("models", `${root}/`);
	const response = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!response.ok) {
		throw new Response(`Provider returned HTTP ${response.status}`, {
			status: 502,
		});
	}
	const body = (await response.json()) as OpenAiModelsResponse;
	return (body.data ?? [])
		.map((item) => item.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function encryptApiKeyOrThrow(plaintext: string): Promise<string> {
	try {
		return await encryptSecret(plaintext);
	} catch (error) {
		throw new Response(
			error instanceof Error ? error.message : "Encryption failed",
			{ status: 500 },
		);
	}
}

export async function clearDefaultIfProviderModels(
	db: AppDatabase,
	userId: string,
	providerId: string,
) {
	const models = await aiModels.listByProviderForUser(db, providerId, userId);
	const defaultId = await getConfigValue(
		db,
		userId,
		CONFIG_KEY_DEFAULT_AI_MODEL,
	);
	if (defaultId && models.some((model) => model.id === defaultId)) {
		await deleteConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL);
	}
}

export async function resolveProviderCredentials(
	db: AppDatabase,
	userId: string,
	input: { id: string } | { baseUrl: string; apiKey: string },
): Promise<{ baseUrl: string; apiKey: string } | null> {
	if ("id" in input) {
		const provider = await getProviderByIdForUser(db, input.id, userId);
		if (!provider) return null;
		return {
			baseUrl: provider.baseUrl,
			apiKey: await decryptSecret(provider.apiKey),
		};
	}
	return { baseUrl: input.baseUrl, apiKey: input.apiKey };
}
