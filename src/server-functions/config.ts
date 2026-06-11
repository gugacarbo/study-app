import { createServerFn } from "@tanstack/react-start";
import { DBQueries } from "../db/queries";
import { loadAiSettings } from "../lib/ai-config";
import { getDB } from "./db";

/** @deprecated Use getAiSettings, listProviders, and listModels */
export const getConfig = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) {
			throw new Error("D1 database not available");
		}

		const queries = new DBQueries(db);
		const [settings, models, providers] = await Promise.all([
			loadAiSettings(queries),
			queries.listEnabledAiModels(),
			queries.listAiProviders(),
		]);

		const defaultModel =
			models.find((model) => model.id === settings.defaultModelId) ??
			models[0] ??
			null;
		const defaultProvider = defaultModel
			? (providers.find((provider) => provider.id === defaultModel.providerId) ??
				null)
			: (providers[0] ?? null);

		return {
			model: defaultModel?.modelId ?? "",
			baseUrl: defaultProvider?.baseUrl,
			hasApiKey: defaultProvider?.hasApiKey ?? false,
		};
	},
);
