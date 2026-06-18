import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { AppDatabase } from "@/db/client";
import { getByIdForUser as getModelByIdForUser } from "@/db/queries/ai-models";
import { getByIdForUser as getProviderByIdForUser } from "@/db/queries/ai-providers";
import { decryptSecret } from "@/lib/config-encryption";

export async function probeModel(
	db: AppDatabase,
	userId: string,
	input: { id: string; modelId?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
	try {
		const model = await getModelByIdForUser(db, input.id, userId);
		if (!model) return { ok: false, error: "Modelo não encontrado" };

		const provider = await getProviderByIdForUser(db, model.providerId, userId);
		if (!provider) return { ok: false, error: "Provider não encontrado" };

		const apiKey = await decryptSecret(provider.apiKey);
		const openai = createOpenAI({
			baseURL: provider.baseUrl,
			apiKey,
		});
		const providerModelId = input.modelId?.trim() || model.modelId;

		await generateText({
			model: openai(providerModelId),
			prompt: "ping",
			maxOutputTokens: 1,
		});
		return { ok: true };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Requisição falhou";
		return { ok: false, error: message };
	}
}
