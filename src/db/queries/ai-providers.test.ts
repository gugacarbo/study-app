import { describe, expect, it } from "vitest";
import {
	deleteProvider,
	getByIdForUser,
	insert,
	listByUserId,
	update,
} from "@/db/queries/ai-providers";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

async function seedUser(
	db: ReturnType<typeof createTestDb>,
	userId: string,
	email: string,
) {
	await db.insert(schema.user).values({
		id: userId,
		name: email.split("@")[0] ?? "User",
		email,
		emailVerified: true,
	});
}

describe("ai-providers queries", () => {
	it("listByUserId returns only providers for the user", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const ownerProviderId = createId();
		const otherProviderId = createId();

		await seedUser(db, ownerId, "owner@aluno.ifsc.edu.br");
		await seedUser(db, otherId, "other@aluno.ifsc.edu.br");

		await insert(db, {
			id: ownerProviderId,
			userId: ownerId,
			name: "Owner Provider",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "enc:v1:iv:cipher",
		});
		await insert(db, {
			id: otherProviderId,
			userId: otherId,
			name: "Other Provider",
			baseUrl: "https://api.example.com/v1",
			apiKey: "enc:v1:iv:other",
		});

		const rows = await listByUserId(db, ownerId);
		expect(rows.map((row) => row.id)).toEqual([ownerProviderId]);
	});

	it("getByIdForUser returns null for another user", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const providerId = createId();

		await seedUser(db, ownerId, "owner@aluno.ifsc.edu.br");
		await seedUser(db, otherId, "other@aluno.ifsc.edu.br");
		await insert(db, {
			id: providerId,
			userId: ownerId,
			name: "Private",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "secret",
		});

		expect(await getByIdForUser(db, providerId, ownerId)).not.toBeNull();
		expect(await getByIdForUser(db, providerId, otherId)).toBeNull();
	});

	it("update changes fields only for the owner", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const providerId = createId();

		await seedUser(db, ownerId, "owner@aluno.ifsc.edu.br");
		await seedUser(db, otherId, "other@aluno.ifsc.edu.br");
		await insert(db, {
			id: providerId,
			userId: ownerId,
			name: "Before",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "secret",
			enabled: true,
		});

		await update(db, providerId, otherId, { name: "Hijacked" });
		expect((await getByIdForUser(db, providerId, ownerId))?.name).toBe(
			"Before",
		);

		await update(db, providerId, ownerId, {
			name: "After",
			enabled: false,
		});
		const updated = await getByIdForUser(db, providerId, ownerId);
		expect(updated?.name).toBe("After");
		expect(updated?.enabled).toBe(false);
	});

	it("deleteProvider removes only owned providers", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const providerId = createId();

		await seedUser(db, ownerId, "owner@aluno.ifsc.edu.br");
		await seedUser(db, otherId, "other@aluno.ifsc.edu.br");
		await insert(db, {
			id: providerId,
			userId: ownerId,
			name: "Delete me",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "secret",
		});

		await deleteProvider(db, providerId, otherId);
		expect(await getByIdForUser(db, providerId, ownerId)).not.toBeNull();

		await deleteProvider(db, providerId, ownerId);
		expect(await getByIdForUser(db, providerId, ownerId)).toBeNull();
	});
});
