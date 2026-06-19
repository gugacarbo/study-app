import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { APICallError } from "ai";
import type { AppDatabase } from "@/db/client";
import { getByIdForUser as getModelByIdForUser } from "@/db/queries/ai-models";
import { getByIdForUser as getProviderByIdForUser } from "@/db/queries/ai-providers";
import type {
	ModelProbeRequest,
	ModelProbeResult,
} from "@/features/admin/types/model-probe";
import { decryptSecret } from "@/lib/config-encryption";

export const PROBE_PROMPT = "ping";
export const PROBE_MAX_OUTPUT_TOKENS = 256;
const RESPONSE_BODY_MAX_LENGTH = 2000;

function truncateText(value: string, maxLength: number) {
	return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function formatProbeError(error: unknown): ModelProbeResult["response"] {
	if (APICallError.isInstance(error)) {
		const responseBody = error.responseBody?.trim();
		const parts = [error.message];
		if (error.statusCode != null) {
			parts.push(`HTTP ${error.statusCode}`);
		}
		if (responseBody) {
			parts.push(truncateText(responseBody, 300));
		}

		return {
			ok: false,
			error: parts.join(" — "),
			statusCode: error.statusCode,
			url: error.url,
			responseBody: responseBody
				? truncateText(responseBody, RESPONSE_BODY_MAX_LENGTH)
				: undefined,
		};
	}

	return {
		ok: false,
		error: error instanceof Error ? error.message : "Requisição falhou",
	};
}

export function buildProbeRequest(
	input: { id: string; modelId?: string },
	overrides: Partial<ModelProbeRequest> = {},
): ModelProbeRequest {
	const testedModelId = input.modelId?.trim() ?? overrides.testedModelId ?? "";
	return {
		modelRowId: input.id,
		savedModelId: overrides.savedModelId ?? "",
		testedModelId,
		displayName: overrides.displayName ?? "",
		providerName: overrides.providerName ?? "",
		providerBaseUrl: overrides.providerBaseUrl ?? "",
		prompt: PROBE_PROMPT,
		maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
		...overrides,
	};
}

export type ResolvedProbeModel = {
	request: ModelProbeRequest;
	model: LanguageModelV3;
};

export async function resolveProbeModel(
	db: AppDatabase,
	userId: string,
	input: { id: string; modelId?: string },
): Promise<
	| { ok: true; probe: ResolvedProbeModel }
	| { ok: false; result: ModelProbeResult }
> {
	const model = await getModelByIdForUser(db, input.id, userId);
	if (!model) {
		return {
			ok: false,
			result: {
				ok: false,
				request: buildProbeRequest(input),
				response: { ok: false, error: "Modelo não encontrado" },
			},
		};
	}

	const provider = await getProviderByIdForUser(db, model.providerId, userId);
	const providerModelId = input.modelId?.trim() || model.modelId;
	const request = buildProbeRequest(input, {
		savedModelId: model.modelId,
		testedModelId: providerModelId,
		displayName: model.displayName,
		providerName: provider?.name ?? "",
		providerBaseUrl: provider?.baseUrl ?? "",
	});

	if (!provider) {
		return {
			ok: false,
			result: {
				ok: false,
				request,
				response: { ok: false, error: "Provider não encontrado" },
			},
		};
	}

	const apiKey = await decryptSecret(provider.apiKey);
	const openai = createOpenAI({
		baseURL: provider.baseUrl,
		apiKey,
	});

	return {
		ok: true,
		probe: {
			request,
			model: openai.chat(providerModelId),
		},
	};
}
