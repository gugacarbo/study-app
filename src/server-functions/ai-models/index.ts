import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import { isModelReferencedInSettings } from "@/lib/ai-config";
import { createAiModelSchema, updateAiModelSchema } from "@/lib/validation";
import { getDB } from "../db";

export const listModels = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		return new DBQueries(db).listAiModels();
	},
);

export const listEnabledModels = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		return new DBQueries(db).listEnabledAiModels();
	},
);

export const createModel = createServerFn({ method: "POST" })
	.inputValidator(createAiModelSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const provider = await queries.getAiProviderById(data.providerId);
		if (!provider) throw new Error("Provider not found");

		const id = await queries.insertAiModel({
			providerId: data.providerId,
			modelId: data.modelId,
			displayName: data.displayName,
			contextWindow: data.contextWindow,
			maxOutputTokens: data.maxOutputTokens,
			inputCostPerMillion: data.inputCostPerMillion,
			outputCostPerMillion: data.outputCostPerMillion,
			thinkingEffortLevels: data.thinkingEffortLevels,
			defaultThinkingEffort: data.defaultThinkingEffort,
			thinkingEnabled: data.thinkingEnabled,
			thinkingParamName: data.thinkingParamName,
			enabled: data.enabled,
			metadata: data.metadata,
			requestParams: data.requestParams,
		});
		return { id };
	});

export const updateModel = createServerFn({ method: "POST" })
	.inputValidator(updateAiModelSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		const existing = await queries.getAiModelById(data.id);
		if (!existing) throw new Error("Model not found");

		await queries.updateAiModel(data.id, {
			modelId: data.modelId,
			displayName: data.displayName,
			contextWindow: data.contextWindow,
			maxOutputTokens: data.maxOutputTokens,
			inputCostPerMillion: data.inputCostPerMillion,
			outputCostPerMillion: data.outputCostPerMillion,
			thinkingEffortLevels: data.thinkingEffortLevels,
			defaultThinkingEffort: data.defaultThinkingEffort,
			thinkingEnabled: data.thinkingEnabled,
			enabled: data.enabled,
			metadata: data.metadata,
			requestParams: data.requestParams,
		});
		return { success: true };
	});

export const deleteModel = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.number().int().positive() }))
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");
		const queries = new DBQueries(db);
		if (await isModelReferencedInSettings(queries, data.id)) {
			throw new Error("Cannot delete model: it is selected in AI settings");
		}
		await queries.deleteAiModel(data.id);
		return { success: true };
	});
