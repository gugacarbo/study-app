import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { z } from "zod";
import * as aiProviders from "@/db/queries/ai-providers";
import { createId } from "@/db/queries/helpers";
import {
	clearDefaultIfProviderModels,
	encryptApiKeyOrThrow,
	fetchOpenAiModelIds,
	getAdminDb,
	probeProvider,
	resolveProviderCredentials,
} from "@/functions/admin/helpers";
import {
	createProviderSchema,
	deleteProviderSchema,
	discoverModelsSchema,
	testProviderSchema,
	updateProviderSchema,
} from "@/functions/admin/providers-schemas";
import { maskApiKey } from "@/lib/ai-config";
import { decryptSecret } from "@/lib/config-encryption";

export async function listProvidersHandler(headers: Headers) {
	const { session, db } = await getAdminDb(headers);
	const rows = await aiProviders.listByUserId(db, session.user.id);
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		baseUrl: row.baseUrl,
		enabled: row.enabled,
		apiKeyMasked: maskApiKey(row.apiKey),
		hasApiKey: row.apiKey.length > 0,
	}));
}

export async function createProviderHandler(
	input: z.infer<typeof createProviderSchema>,
	headers: Headers,
) {
	const { session, db } = await getAdminDb(headers);
	const id = createId();
	await aiProviders.insert(db, {
		id,
		userId: session.user.id,
		name: input.name,
		baseUrl: input.baseUrl,
		apiKey: await encryptApiKeyOrThrow(input.apiKey),
		enabled: input.enabled ?? true,
	});
	return { id };
}

export async function updateProviderHandler(
	input: z.infer<typeof updateProviderSchema>,
	headers: Headers,
) {
	const { session, db } = await getAdminDb(headers);
	if (!(await aiProviders.getByIdForUser(db, input.id, session.user.id))) {
		throw new Response("Not Found", { status: 404 });
	}
	const patch: Parameters<typeof aiProviders.update>[3] = {};
	if (input.name !== undefined) patch.name = input.name;
	if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl;
	if (input.enabled !== undefined) patch.enabled = input.enabled;
	if (input.apiKey !== undefined && input.apiKey.trim() !== "") {
		patch.apiKey = await encryptApiKeyOrThrow(input.apiKey.trim());
	}
	await aiProviders.update(db, input.id, session.user.id, patch);
	return { id: input.id };
}

export async function deleteProviderHandler(
	input: z.infer<typeof deleteProviderSchema>,
	headers: Headers,
) {
	const { session, db } = await getAdminDb(headers);
	if (!(await aiProviders.getByIdForUser(db, input.id, session.user.id))) {
		throw new Response("Not Found", { status: 404 });
	}
	await clearDefaultIfProviderModels(db, session.user.id, input.id);
	await aiProviders.deleteProvider(db, input.id, session.user.id);
}

export async function testProviderHandler(
	input: z.infer<typeof testProviderSchema>,
	headers: Headers,
) {
	const { session, db } = await getAdminDb(headers);
	const credentials = await resolveProviderCredentials(
		db,
		session.user.id,
		input,
	);
	if (!credentials) throw new Response("Not Found", { status: 404 });
	const probe = await probeProvider(credentials.baseUrl, credentials.apiKey);
	if ("id" in input) {
		const provider = await aiProviders.getByIdForUser(
			db,
			input.id,
			session.user.id,
		);
		if (!provider) throw new Response("Not Found", { status: 404 });
		return {
			...probe,
			providerId: provider.id,
			providerName: provider.name,
			baseUrl: provider.baseUrl,
		};
	}
	return probe;
}

export async function discoverModelsHandler(
	input: z.infer<typeof discoverModelsSchema>,
	headers: Headers,
) {
	const { session, db } = await getAdminDb(headers);
	const provider = await aiProviders.getByIdForUser(
		db,
		input.providerId,
		session.user.id,
	);
	if (!provider) throw new Response("Not Found", { status: 404 });
	if (!provider.enabled) {
		throw new Response("Provider is disabled", { status: 400 });
	}
	const modelIds = await fetchOpenAiModelIds(
		provider.baseUrl,
		await decryptSecret(provider.apiKey),
	);
	return {
		models: modelIds.map((modelId) => ({ modelId, displayName: modelId })),
	};
}

const headers = () => getRequest().headers;

export const listProviders = createServerFn({ method: "GET" }).handler(
	async () => listProvidersHandler(headers()),
);

export const createProvider = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createProviderSchema.parse(data))
	.handler(async ({ data }) => createProviderHandler(data, headers()));

export const updateProvider = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateProviderSchema.parse(data))
	.handler(async ({ data }) => updateProviderHandler(data, headers()));

export const deleteProvider = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteProviderSchema.parse(data))
	.handler(async ({ data }) => deleteProviderHandler(data, headers()));

export const testProvider = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => testProviderSchema.parse(data))
	.handler(async ({ data }) => testProviderHandler(data, headers()));

export const discoverModels = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => discoverModelsSchema.parse(data))
	.handler(async ({ data }) => discoverModelsHandler(data, headers()));
