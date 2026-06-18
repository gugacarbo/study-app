import { beforeEach, describe, expect, it } from "vitest";
import { upsert as upsertModelQuery } from "@/db/queries/ai-models";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	getConfigValue,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import {
	adminUserId,
	otherUserId,
	resetAdminTestDb,
	seedProvider,
	testDb,
} from "@/functions/admin/admin-test-setup";
import {
	deleteModelHandler,
	listModelsHandler,
	upsertModelHandler,
} from "@/functions/admin/models";

describe("admin models handlers", () => {
	beforeEach(() => {
		resetAdminTestDb();
	});

	it("listModels returns models for an owned provider", async () => {
		const providerId = await seedProvider(testDb, adminUserId);
		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});

		const result = await listModelsHandler({ providerId }, new Headers());
		expect(result.models.map((row) => row.id)).toEqual([modelRowId]);
	});

	it("listModels returns 404 for another user's provider", async () => {
		const providerId = await seedProvider(testDb, otherUserId);
		await expect(
			listModelsHandler({ providerId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("upsertModel creates and updates by provider model id", async () => {
		const providerId = await seedProvider(testDb, adminUserId);
		const created = await upsertModelHandler(
			{
				providerId,
				modelId: "gpt-4o",
				displayName: "GPT-4o",
			},
			new Headers(),
		);
		const updated = await upsertModelHandler(
			{
				providerId,
				modelId: "gpt-4o",
				displayName: "GPT-4o updated",
				enabled: false,
			},
			new Headers(),
		);

		expect(updated.id).toBe(created.id);
		const listed = await listModelsHandler({ providerId }, new Headers());
		expect(listed.models[0]?.displayName).toBe("GPT-4o updated");
		expect(listed.models[0]?.enabled).toBe(false);
	});

	it("deleteModel clears default when deleting the default model", async () => {
		const providerId = await seedProvider(testDb, adminUserId);
		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});
		await setConfigValue(
			testDb,
			adminUserId,
			CONFIG_KEY_DEFAULT_AI_MODEL,
			modelRowId,
		);

		await deleteModelHandler({ id: modelRowId }, new Headers());

		expect(
			await getConfigValue(testDb, adminUserId, CONFIG_KEY_DEFAULT_AI_MODEL),
		).toBeNull();
		expect(
			(await listModelsHandler({ providerId }, new Headers())).models,
		).toEqual([]);
	});
});
