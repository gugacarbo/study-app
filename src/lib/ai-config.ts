import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
	extractJsonMiddleware,
	extractReasoningMiddleware,
	wrapLanguageModel,
} from "ai";
import type { AppDatabase } from "@/db/client";
import { getByIdForUser as getModelByIdForUser } from "@/db/queries/ai-models";
import { getByIdForUser as getProviderByIdForUser } from "@/db/queries/ai-providers";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	getConfigValue,
} from "@/db/queries/config";
import { decryptSecret } from "@/lib/config-encryption";

const MASK_PREFIX = "••••";

export function maskApiKey(value: string): string {
	const suffix = value.slice(-4);
	return `${MASK_PREFIX}${suffix}`;
}

export async function resolveAiModelId(input: {
	db: AppDatabase;
	userId: string;
	modelId?: string;
}): Promise<string> {
	const resolvedModelId = await resolveModelId(
		input.db,
		input.userId,
		input.modelId,
	);
	const model = await getModelByIdForUser(
		input.db,
		resolvedModelId,
		input.userId,
	);
	if (!model) {
		throw new Error(`Modelo de IA não encontrado: ${resolvedModelId}`);
	}
	if (!model.enabled) {
		throw new Error(`Modelo de IA desabilitado: ${model.displayName}`);
	}

	const provider = await getProviderByIdForUser(
		input.db,
		model.providerId,
		input.userId,
	);
	if (!provider) {
		throw new Error(
			`Provider de IA não encontrado para o modelo: ${model.displayName}`,
		);
	}
	if (!provider.enabled) {
		throw new Error(`Provider de IA desabilitado: ${provider.name}`);
	}

	return resolvedModelId;
}

export async function getAiModel(input: {
	db: AppDatabase;
	userId: string;
	modelId?: string;
}): Promise<LanguageModelV3> {
	const resolvedModelId = await resolveAiModelId(input);
	const model = await getModelByIdForUser(
		input.db,
		resolvedModelId,
		input.userId,
	);
	if (!model) {
		throw new Error(`Modelo de IA não encontrado: ${resolvedModelId}`);
	}

	const provider = await getProviderByIdForUser(
		input.db,
		model.providerId,
		input.userId,
	);
	if (!provider) {
		throw new Error(
			`Provider de IA não encontrado para o modelo: ${model.displayName}`,
		);
	}

	const apiKey = await decryptSecret(provider.apiKey);
	const openai = createOpenAI({
		baseURL: provider.baseUrl,
		apiKey,
	});

	return wrapLanguageModel({
		model: openai.chat(model.modelId),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "redacted_thinking" }),
			extractJsonMiddleware(),
		],
	});
}

async function resolveModelId(
	db: AppDatabase,
	userId: string,
	modelId?: string,
): Promise<string> {
	if (modelId) return modelId;

	const defaultModelId = await getConfigValue(
		db,
		userId,
		CONFIG_KEY_DEFAULT_AI_MODEL,
	);
	if (!defaultModelId) {
		throw new Error("Nenhum modelo padrão configurado.");
	}

	return defaultModelId;
}
