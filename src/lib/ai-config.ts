import type { DBQueries } from "@/db/queries/base";
import { env } from "@/env";
import { encryptSecret, decryptSecret } from "@/lib/config-encryption";
import {
	AI_AGENT_TASKS,
	type AiAgentTask,
	agentModelConfigKey,
	type AiSettings,
	type ResolvedModelConfig,
} from "@/lib/validation";

export type { ResolvedModelConfig };

export async function encryptApiKeyForStorage(apiKey: string): Promise<string> {
	return encryptSecret(apiKey);
}

export async function decryptStoredApiKey(
	stored: string | undefined,
): Promise<string | undefined> {
	if (!stored?.trim()) return undefined;
	return decryptSecret(stored);
}

function parseModelId(value: string | undefined): number | null {
	if (!value?.trim()) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function resolveModelIdForAgent(
	queries: DBQueries,
	agent?: AiAgentTask,
): Promise<number | null> {
	const config = await queries.getAllConfig();
	if (agent) {
		const override = parseModelId(config[agentModelConfigKey(agent)]);
		if (override) return override;
	}
	return parseModelId(config.ai_default_model_id);
}

async function resolvedFromModelRow(
	queries: DBQueries,
	modelId: number,
): Promise<ResolvedModelConfig | null> {
	const row = await queries.getResolvedAiModelById(modelId);
	if (!row) return null;

	const apiKey = await decryptStoredApiKey(row.providerApiKey);
	if (!apiKey) return null;

	return {
		modelId: row.id,
		model: row.modelId,
		baseUrl: row.providerBaseUrl,
		apiKey,
		providerName: row.providerName,
		contextWindow: row.contextWindow,
		inputCostPerMillion: row.inputCostPerMillion,
		outputCostPerMillion: row.outputCostPerMillion,
	};
}

async function legacyProviderConfig(
	queries: DBQueries,
): Promise<ResolvedModelConfig | null> {
	const config = await queries.getAllConfig();
	const apiKey =
		(await decryptStoredApiKey(config.ai_api_key)) ||
		env.OPENROUTER_API_KEY ||
		undefined;
	const baseUrl = config.ai_base_url?.trim();
	if (!apiKey || !baseUrl) return null;

	return {
		modelId: 0,
		model: config.ai_model || env.AI_MODEL,
		baseUrl,
		apiKey,
		providerName: "legacy",
	};
}

export async function resolveModelConfig(
	queries: DBQueries,
	agent?: AiAgentTask,
): Promise<ResolvedModelConfig | null> {
	const modelId = await resolveModelIdForAgent(queries, agent);
	if (modelId) {
		const resolved = await resolvedFromModelRow(queries, modelId);
		if (resolved) return resolved;
	}

	const providers = await queries.listAiProviders();
	if (providers.length > 0) {
		const enabled = await queries.listEnabledAiModels();
		const first = enabled[0];
		if (first) {
			return resolvedFromModelRow(queries, first.id);
		}
	}

	return legacyProviderConfig(queries);
}

export async function requireModelConfig(
	queries: DBQueries,
	agent?: AiAgentTask,
): Promise<ResolvedModelConfig> {
	const config = await resolveModelConfig(queries, agent);
	if (!config) {
		throw new Error(
			"AI not configured. Add providers and models in /config first.",
		);
	}
	return config;
}

export async function resolveModelConfigById(
	queries: DBQueries,
	modelId: number,
): Promise<ResolvedModelConfig> {
	const resolved = await resolvedFromModelRow(queries, modelId);
	if (!resolved) {
		throw new Error("Selected model is not available");
	}
	return resolved;
}

export async function loadAiSettings(queries: DBQueries): Promise<AiSettings> {
	const config = await queries.getAllConfig();
	const agentModels = Object.fromEntries(
		AI_AGENT_TASKS.map((agent) => [
			agent,
			parseModelId(config[agentModelConfigKey(agent)]),
		]),
	);

	return {
		defaultModelId: parseModelId(config.ai_default_model_id),
		agentModels,
	};
}

export async function isModelReferencedInSettings(
	queries: DBQueries,
	modelId: number,
): Promise<boolean> {
	const settings = await loadAiSettings(queries);
	if (settings.defaultModelId === modelId) return true;
	return Object.values(settings.agentModels).some((id) => id === modelId);
}

/** @deprecated Use requireModelConfig */
export async function requireProviderConfigFromDb(
	queries: DBQueries,
	agent?: AiAgentTask,
): Promise<ResolvedModelConfig> {
	return requireModelConfig(queries, agent);
}

/** @deprecated Use resolveModelConfig */
export async function loadProviderConfigFromDb(
	queries: DBQueries,
	agent?: AiAgentTask,
): Promise<ResolvedModelConfig | null> {
	return resolveModelConfig(queries, agent);
}

/** @deprecated Use resolveModelConfigById */
export async function resolveProviderConfigForTest(
	queries: DBQueries,
	modelId: number,
): Promise<ResolvedModelConfig> {
	return resolveModelConfigById(queries, modelId);
}
