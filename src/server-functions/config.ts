import { createServerFn } from "@tanstack/react-start";
import { DBQueries } from "../db/queries";
import {
	encryptApiKeyForStorage,
	loadPublicAiConfig,
} from "../lib/ai-config";
import {
	type AiProvider,
	configFormInputSchema,
	inferAiProvider,
} from "../lib/validation";
import { getDB } from "./db";

export const getConfig = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) {
			throw new Error("D1 database not available");
		}

		const queries = new DBQueries(db);
		return loadPublicAiConfig(queries);
	},
);

export const setConfig = createServerFn({ method: "POST" })
	.inputValidator(configFormInputSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) {
			throw new Error("D1 database not available");
		}

		const queries = new DBQueries(db);
		const existing = await queries.getAllConfig();
		const nextApiKey = data.apiKey?.trim();

		if (!nextApiKey && !existing.ai_api_key?.trim()) {
			throw new Error("API key is required");
		}

		const provider = data.baseUrl
			? inferAiProvider(data.baseUrl)
			: ((existing.ai_provider as AiProvider | undefined) ?? "openrouter");

		await queries.setConfig("ai_provider", provider);
		await queries.setConfig("ai_model", data.model);
		if (data.baseUrl) {
			await queries.setConfig("ai_base_url", data.baseUrl);
		}
		if (nextApiKey) {
			await queries.setConfig(
				"ai_api_key",
				await encryptApiKeyForStorage(nextApiKey),
			);
		}

		return { success: true };
	});
