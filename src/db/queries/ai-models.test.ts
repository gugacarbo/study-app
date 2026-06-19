import { describe, expect, it } from "vitest";
import type { AppDatabase } from "@/db/client";
import {
	deleteModel,
	getByIdForUser,
	listByProviderForUser,
	upsert,
} from "@/db/queries/ai-models";
import { insert as insertProvider } from "@/db/queries/ai-providers";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

async function seedProvider(
	db: AppDatabase,
	userId: string,
	providerId = createId(),
) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
	await insertProvider(db, {
		id: providerId,
		userId,
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "secret",
	});
	return providerId;
}

describe("ai-models queries", () => {
	it("listByProviderForUser returns models when provider is owned", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const providerId = await seedProvider(db, ownerId);
		const modelId = createId();
		await seedProvider(db, otherId);
		await upsert(db, {
			id: modelId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});

		expect(
			(await listByProviderForUser(db, providerId, ownerId)).map(
				(row) => row.id,
			),
		).toEqual([modelId]);
		expect(await listByProviderForUser(db, providerId, otherId)).toEqual([]);
	});

	it("getByIdForUser returns null for another user", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const providerId = await seedProvider(db, ownerId);
		const modelId = createId();
		await seedProvider(db, otherId);
		await upsert(db, {
			id: modelId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});

		expect(await getByIdForUser(db, modelId, ownerId)).not.toBeNull();
		expect(await getByIdForUser(db, modelId, otherId)).toBeNull();
	});

	it("upsert inserts and updates on provider_id + model_id conflict", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const providerId = await seedProvider(db, ownerId);
		const firstRowId = createId();

		expect(
			await upsert(db, {
				id: firstRowId,
				providerId,
				modelId: "gpt-4o",
				displayName: "GPT-4o",
				enabled: true,
			}),
		).toBe(firstRowId);
		expect(
			await upsert(db, {
				id: createId(),
				providerId,
				modelId: "gpt-4o",
				displayName: "GPT-4o updated",
				enabled: false,
			}),
		).toBe(firstRowId);

		const models = await listByProviderForUser(db, providerId, ownerId);
		expect(models).toHaveLength(1);
		expect(models[0]?.displayName).toBe("GPT-4o updated");
		expect(models[0]?.enabled).toBe(false);
	});

	it("deleteModel removes only owned models", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const providerId = await seedProvider(db, ownerId);
		const modelId = createId();
		await seedProvider(db, otherId);
		await upsert(db, {
			id: modelId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
		});

		await deleteModel(db, modelId, otherId);
		expect(await getByIdForUser(db, modelId, ownerId)).not.toBeNull();
		await deleteModel(db, modelId, ownerId);
		expect(await getByIdForUser(db, modelId, ownerId)).toBeNull();
	});
});
