import { createServerFn } from "@tanstack/react-start";
import { DBQueries } from "@/db/queries";
import { loadAiSettings } from "@/lib/ai-config";
import {
	agentModelConfigKey,
	setAgentModelSchema,
	setDefaultModelSchema,
} from "@/lib/validation";
import { getDB } from "./db";

export const getAiSettings = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		return loadAiSettings(new DBQueries(db));
	},
);

export const setDefaultModel = createServerFn({ method: "POST" })
	.inputValidator(setDefaultModelSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const model = await queries.getResolvedAiModelById(data.modelId);
		if (!model) throw new Error("Model not found or disabled");
		await queries.setConfig("ai_default_model_id", String(data.modelId));
		return { success: true };
	});

export const setAgentModel = createServerFn({ method: "POST" })
	.inputValidator(setAgentModelSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const key = agentModelConfigKey(data.agent);

		if (data.modelId === null) {
			await queries.setConfig(key, "");
			return { success: true };
		}

		const model = await queries.getResolvedAiModelById(data.modelId);
		if (!model) throw new Error("Model not found or disabled");
		await queries.setConfig(key, String(data.modelId));
		return { success: true };
	});
