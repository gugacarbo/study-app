import { describe, expect, it } from "vitest";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	deleteConfigValue,
	getConfigValue,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

describe("config queries", () => {
	it("getConfigValue returns null when unset", async () => {
		const db = createTestDb();
		const userId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		expect(
			await getConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL),
		).toBeNull();
	});

	it("setConfigValue upserts by user and key", async () => {
		const db = createTestDb();
		const userId = createId();
		const modelId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		await setConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL, modelId);
		expect(await getConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL)).toBe(
			modelId,
		);

		const updatedModelId = createId();
		await setConfigValue(
			db,
			userId,
			CONFIG_KEY_DEFAULT_AI_MODEL,
			updatedModelId,
		);
		expect(await getConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL)).toBe(
			updatedModelId,
		);
	});

	it("deleteConfigValue removes the entry", async () => {
		const db = createTestDb();
		const userId = createId();
		const modelId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "U",
			email: "u@aluno.ifsc.edu.br",
			emailVerified: true,
		});

		await setConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL, modelId);
		await deleteConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL);

		expect(
			await getConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL),
		).toBeNull();
	});
});
