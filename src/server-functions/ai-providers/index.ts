import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import {
	encryptApiKeyForStorage,
	isModelReferencedInSettings,
} from "@/lib/ai-config";
import {
	createAiProviderSchema,
	updateAiProviderSchema,
} from "@/lib/validation";
import { getDB } from "../db";

export const listProviders = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		return new DBQueries(db).listAiProviders();
	},
);

export const createProvider = createServerFn({ method: "POST" })
	.inputValidator(createAiProviderSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const id = await queries.insertAiProvider({
			name: data.name,
			baseUrl: data.baseUrl,
			apiKey: await encryptApiKeyForStorage(data.apiKey),
			enabled: data.enabled,
		});
		return { id };
	});

export const updateProvider = createServerFn({ method: "POST" })
	.inputValidator(updateAiProviderSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const existing = await queries.getAiProviderById(data.id);
		if (!existing) throw new Error("Provider not found");

		const nextApiKey = data.apiKey?.trim();
		if (!nextApiKey && !existing.api_key?.trim()) {
			throw new Error("API key is required");
		}

		await queries.updateAiProvider(data.id, {
			name: data.name,
			baseUrl: data.baseUrl,
			apiKey: nextApiKey
				? await encryptApiKeyForStorage(nextApiKey)
				: undefined,
			enabled: data.enabled,
		});
		return { success: true };
	});

export const deleteProvider = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.number().int().positive() }))
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const models = await queries.listAiModels(data.id);
		for (const model of models) {
			if (await isModelReferencedInSettings(queries, model.id)) {
				throw new Error(
					"Cannot delete provider: one or more models are selected in AI settings",
				);
			}
		}
		await queries.deleteAiProvider(data.id);
		return { success: true };
	});
