import { beforeEach, describe, expect, it } from "vitest";
import { upsert as upsertModelQuery } from "@/db/queries/ai-models";
import { insert as insertProvider } from "@/db/queries/ai-providers";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import {
	adminUserId,
	resetAdminTestDb,
	testDb,
} from "@/functions/admin/admin-test-setup";
import { getAdminAiConfigHandler } from "@/functions/admin/config";

describe("getAdminAiConfig", () => {
	beforeEach(() => {
		resetAdminTestDb();
	});

	it("returns masked providers, all models, and defaultModelId", async () => {
		await testDb.insert(schema.user).values({
			id: adminUserId,
			name: "Admin",
			email: `${adminUserId}@aluno.ifsc.edu.br`,
			emailVerified: true,
		});

		const providerId = createId();
		await insertProvider(testDb, {
			id: providerId,
			userId: adminUserId,
			name: "OpenAI",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "enc:v1:iv:cipher1234",
			enabled: true,
		});

		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
			enabled: true,
		});
		await setConfigValue(testDb, adminUserId, CONFIG_KEY_DEFAULT_AI_MODEL, modelRowId);

		const snapshot = await getAdminAiConfigHandler(new Headers());

		expect(snapshot.defaultModelId).toBe(modelRowId);
		expect(snapshot.providers).toEqual([
			expect.objectContaining({
				id: providerId,
				name: "OpenAI",
				apiKeyMasked: "••••1234",
				hasApiKey: true,
			}),
		]);
		expect(snapshot.models.map((row) => row.id)).toEqual([modelRowId]);
		expect(snapshot.providers[0]).not.toHaveProperty("apiKey");
	});

	it("reports hasApiKey false when provider has no key", async () => {
		await testDb.insert(schema.user).values({
			id: adminUserId,
			name: "Admin",
			email: `${adminUserId}@aluno.ifsc.edu.br`,
			emailVerified: true,
		});
		await insertProvider(testDb, {
			id: createId(),
			userId: adminUserId,
			name: "Empty",
			baseUrl: "https://api.example.com/v1",
			apiKey: "",
		});

		const snapshot = await getAdminAiConfigHandler(new Headers());
		expect(snapshot.providers[0]?.hasApiKey).toBe(false);
	});
});
