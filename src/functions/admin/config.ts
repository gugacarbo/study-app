import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { listByProviderForUser } from "@/db/queries/ai-models";
import { listByUserId } from "@/db/queries/ai-providers";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	getConfigValue,
} from "@/db/queries/config";
import { requireDB } from "@/functions/db";
import { maskApiKey } from "@/lib/ai-config";
import { requireAdminSession } from "@/lib/rbac";

export async function getAdminAiConfigHandler(headers: Headers) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());
	const userId = session.user.id;

	const providers = await listByUserId(db, userId);
	const models = (
		await Promise.all(
			providers.map((provider) =>
				listByProviderForUser(db, provider.id, userId),
			),
		)
	).flat();

	return {
		providers: providers.map((row) => ({
			id: row.id,
			name: row.name,
			baseUrl: row.baseUrl,
			enabled: row.enabled,
			apiKeyMasked: maskApiKey(row.apiKey),
			hasApiKey: row.apiKey.length > 0,
		})),
		models,
		defaultModelId: await getConfigValue(
			db,
			userId,
			CONFIG_KEY_DEFAULT_AI_MODEL,
		),
	};
}

export const getAdminAiConfig = createServerFn({ method: "GET" }).handler(
	async () => getAdminAiConfigHandler(getRequest().headers),
);
