import type { DBQueries } from "@/db/queries/base";
import { env } from "@/env";
import {
	decryptSecret,
	encryptSecret,
} from "@/lib/config-encryption";
import {
	type AiProvider,
	type ConfigFormInput,
	inferAiProvider,
	type ProviderConfig,
} from "@/lib/validation";

export type PublicAiConfig = {
	provider: AiProvider;
	model: string;
	baseUrl?: string;
	hasApiKey: boolean;
};

export async function encryptApiKeyForStorage(apiKey: string): Promise<string> {
	return encryptSecret(apiKey);
}

export async function decryptStoredApiKey(
	stored: string | undefined,
): Promise<string | undefined> {
	if (!stored?.trim()) return undefined;
	return decryptSecret(stored);
}

export async function loadPublicAiConfig(
	queries: DBQueries,
): Promise<PublicAiConfig> {
	const config = await queries.getAllConfig();
	const provider =
		(config.ai_provider as AiProvider | undefined) ||
		inferAiProvider(config.ai_base_url);

	return {
		provider,
		model: config.ai_model || env.AI_MODEL,
		baseUrl: config.ai_base_url || undefined,
		hasApiKey: Boolean(config.ai_api_key?.trim()),
	};
}

export async function loadProviderConfigFromDb(
	queries: DBQueries,
): Promise<ProviderConfig | null> {
	const config = await queries.getAllConfig();
	const apiKey =
		(await decryptStoredApiKey(config.ai_api_key)) ||
		env.OPENROUTER_API_KEY ||
		undefined;

	if (!apiKey) return null;

	const provider =
		(config.ai_provider as AiProvider | undefined) ||
		inferAiProvider(config.ai_base_url);

	return {
		provider,
		model: config.ai_model || env.AI_MODEL,
		baseUrl: config.ai_base_url || undefined,
		apiKey,
	};
}

export async function requireProviderConfigFromDb(
	queries: DBQueries,
): Promise<ProviderConfig> {
	const providerConfig = await loadProviderConfigFromDb(queries);
	if (!providerConfig) {
		throw new Error(
			"AI API key not configured. Please configure it in /config first.",
		);
	}
	return providerConfig;
}

export async function resolveProviderConfigForTest(
	queries: DBQueries,
	input: ConfigFormInput,
): Promise<ProviderConfig> {
	const stored = await queries.getAllConfig();
	const apiKey =
		input.apiKey?.trim() ||
		(await decryptStoredApiKey(stored.ai_api_key)) ||
		env.OPENROUTER_API_KEY ||
		undefined;

	if (!apiKey) {
		throw new Error("AI API key not configured");
	}

	const provider = input.baseUrl
		? inferAiProvider(input.baseUrl)
		: ((stored.ai_provider as AiProvider | undefined) ?? "openrouter");

	return {
		provider,
		model: input.model,
		baseUrl: input.baseUrl,
		apiKey,
	};
}
