import { describe, expect, it, vi } from "vitest";
import {
	insert as insertProvider,
	update as updateProvider,
} from "@/db/queries/ai-providers";
import { upsert as upsertModel } from "@/db/queries/ai-models";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import type { AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

const mockCreateOpenAI = vi.fn();
const mockLanguageModel = { modelId: "gpt-4o" };

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}));

vi.mock("@/lib/config-encryption", () => ({
	decryptSecret: vi.fn(async (stored: string) => stored),
}));

const { decryptSecret } = await import("@/lib/config-encryption");
const { getAiModel, maskApiKey } = await import("@/lib/ai-config");

async function seedEnabledModel(db: AppDatabase, userId = createId()) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});

	const providerId = createId();
	await insertProvider(db, {
		id: providerId,
		userId,
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "enc:v1:iv:cipher1234",
		enabled: true,
	});

	const modelRowId = createId();
	await upsertModel(db, {
		id: modelRowId,
		providerId,
		modelId: "gpt-4o",
		displayName: "GPT-4o",
		enabled: true,
	});

	return { userId, providerId, modelRowId };
}

describe("maskApiKey", () => {
	it("masks plaintext with last four characters", () => {
		expect(maskApiKey("sk-test-api-key-12345")).toBe("••••2345");
	});

	it("masks ciphertext with last four characters", () => {
		expect(maskApiKey("enc:v1:abc:defghijkl")).toBe("••••ijkl");
	});
});

describe("getAiModel", () => {
	it("throws a clear error when no default model is configured", async () => {
		const db = createTestDb();
		const { userId } = await seedEnabledModel(db);

		await expect(getAiModel({ db, userId })).rejects.toThrow(
			/Nenhum modelo padrão configurado/,
		);
	});

	it("resolves the default model from config", async () => {
		const db = createTestDb();
		const { userId, modelRowId } = await seedEnabledModel(db);
		await setConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL, modelRowId);

		mockCreateOpenAI.mockReturnValue(() => mockLanguageModel);

		const model = await getAiModel({ db, userId });

		expect(model).toBe(mockLanguageModel);
		expect(mockCreateOpenAI).toHaveBeenCalledWith({
			baseURL: "https://api.openai.com/v1",
			apiKey: "enc:v1:iv:cipher1234",
		});
		expect(decryptSecret).toHaveBeenCalledWith("enc:v1:iv:cipher1234");
	});

	it("uses an explicit modelId and rejects disabled models", async () => {
		const db = createTestDb();
		const { userId, providerId } = await seedEnabledModel(db);
		const disabledModelId = createId();

		await upsertModel(db, {
			id: disabledModelId,
			providerId,
			modelId: "gpt-4o-mini",
			displayName: "GPT-4o mini",
			enabled: false,
		});

		mockCreateOpenAI.mockReturnValue(() => mockLanguageModel);

		await expect(
			getAiModel({ db, userId, modelId: disabledModelId }),
		).rejects.toThrow(/Modelo de IA desabilitado/);

		await upsertModel(db, {
			id: disabledModelId,
			providerId,
			modelId: "gpt-4o-mini",
			displayName: "GPT-4o mini",
			enabled: true,
		});

		const model = await getAiModel({ db, userId, modelId: disabledModelId });
		expect(model).toBe(mockLanguageModel);
	});

	it("rejects disabled providers", async () => {
		const db = createTestDb();
		const { userId, providerId, modelRowId } = await seedEnabledModel(db);

		await updateProvider(db, providerId, userId, { enabled: false });

		await expect(
			getAiModel({ db, userId, modelId: modelRowId }),
		).rejects.toThrow(/Provider de IA desabilitado/);
	});
});
