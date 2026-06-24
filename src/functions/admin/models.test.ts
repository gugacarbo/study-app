import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getByIdForUser,
	upsert as upsertModelQuery,
} from "@/db/queries/ai-models";
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
	testModelHandler,
	upsertModelHandler,
} from "@/functions/admin/models";

vi.mock("@/functions/admin/probe-model", () => ({
	probeModel: vi.fn(),
}));

const { probeModel } = await import("@/functions/admin/probe-model");

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

	it("testModel probes the model with optional modelId override", async () => {
		const providerId = await seedProvider(testDb, adminUserId);
		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});
		vi.mocked(probeModel).mockResolvedValueOnce({
			ok: true,
			request: {
				modelRowId,
				savedModelId: "gpt-4o",
				testedModelId: "gpt-4o-mini",
				displayName: "GPT-4o",
				providerName: "OpenAI",
				providerBaseUrl: "https://api.openai.com/v1",
				prompt: "ping",
				maxOutputTokens: 256,
				timeoutMs: 45000,
			},
			response: { ok: true, text: "p" },
		});

		const result = await testModelHandler(
			{ id: modelRowId, modelId: "gpt-4o-mini", timeoutMs: 45000 },
			new Headers(),
		);

		expect(result).toEqual({
			ok: true,
			request: expect.objectContaining({ testedModelId: "gpt-4o-mini" }),
			response: { ok: true, text: "p" },
		});
		expect(probeModel).toHaveBeenCalledWith(testDb, adminUserId, {
			id: modelRowId,
			modelId: "gpt-4o-mini",
			timeoutMs: 45000,
		});
		expect((await getByIdForUser(testDb, modelRowId, adminUserId))?.healthStatus).toBe(
			"active",
		);
	});

	it("testModel persists offline when the probe fails", async () => {
		const providerId = await seedProvider(testDb, adminUserId);
		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});
		vi.mocked(probeModel).mockResolvedValueOnce({
			ok: false,
			request: {
				modelRowId,
				savedModelId: "gpt-4o",
				testedModelId: "gpt-4o",
				displayName: "GPT-4o",
				providerName: "OpenAI",
				providerBaseUrl: "https://api.openai.com/v1",
				prompt: "ping",
				maxOutputTokens: 256,
				timeoutMs: 30000,
			},
			response: { ok: false, error: "timeout" },
		});

		await testModelHandler({ id: modelRowId }, new Headers());

		expect((await getByIdForUser(testDb, modelRowId, adminUserId))?.healthStatus).toBe(
			"offline",
		);
	});

	it("testModel returns 404 for another user's model", async () => {
		const providerId = await seedProvider(testDb, otherUserId);
		const modelRowId = createId();
		await upsertModelQuery(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});

		await expect(
			testModelHandler({ id: modelRowId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});
});
