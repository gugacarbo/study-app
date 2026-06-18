import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { upsert as upsertModelQuery } from "@/db/queries/ai-models";
import { insert as insertProvider } from "@/db/queries/ai-providers";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	getConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import {
	adminUserId,
	resetAdminTestDb,
	seedProvider,
	testDb,
} from "@/functions/admin/admin-test-setup";
import { setDefaultModelHandler } from "@/functions/admin/models";

describe("setDefaultModel handler", () => {
	beforeEach(() => {
		resetAdminTestDb();
	});

	it("rejects disabled model or provider", async () => {
		const providerId = await seedProvider(testDb, adminUserId, false);
		const disabledModelId = createId();
		await upsertModelQuery(testDb, {
			id: disabledModelId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
			enabled: false,
		});

		await expect(
			setDefaultModelHandler({ modelId: disabledModelId }, new Headers()),
		).rejects.toMatchObject({ status: 400 });

		const enabledProviderId = createId();
		await insertProvider(testDb, {
			id: enabledProviderId,
			userId: adminUserId,
			name: "OpenAI 2",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "enc:v1:iv:secret1234",
			enabled: true,
		});
		const enabledModelId = createId();
		await upsertModelQuery(testDb, {
			id: enabledModelId,
			providerId: enabledProviderId,
			modelId: "gpt-4.1",
			displayName: "GPT-4.1",
			enabled: true,
		});
		await testDb
			.update(schema.aiProviders)
			.set({ enabled: false })
			.where(eq(schema.aiProviders.id, enabledProviderId));

		await expect(
			setDefaultModelHandler({ modelId: enabledModelId }, new Headers()),
		).rejects.toMatchObject({ status: 400 });
	});

	it("sets and clears the default model", async () => {
		const providerId = await seedProvider(testDb, adminUserId);
		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});

		await setDefaultModelHandler({ modelId: modelRowId }, new Headers());
		expect(
			await getConfigValue(testDb, adminUserId, CONFIG_KEY_DEFAULT_AI_MODEL),
		).toBe(modelRowId);

		await setDefaultModelHandler({ modelId: null }, new Headers());
		expect(
			await getConfigValue(testDb, adminUserId, CONFIG_KEY_DEFAULT_AI_MODEL),
		).toBeNull();
	});
});
