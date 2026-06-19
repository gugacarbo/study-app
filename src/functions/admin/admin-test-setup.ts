import type { D1Database } from "@cloudflare/workers-types";
import { vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { insert as insertProvider } from "@/db/queries/ai-providers";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

export const adminUserId = "00000000-0000-4000-8000-000000000099";
export const otherUserId = "00000000-0000-4000-8000-000000000098";
export const testDb = createTestDb();

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({}) as D1Database),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: vi.fn(() => testDb),
	};
});

vi.mock("@/lib/rbac", () => ({
	requireAdminSession: vi.fn(async () => ({
		user: { id: adminUserId },
		session: { id: "session-1" },
	})),
}));

export function resetAdminTestDb() {
	const sqlite = (
		testDb as unknown as {
			session: { client: { exec: (sql: string) => void } };
		}
	).session.client;
	for (const table of [
		"config",
		"ai_models",
		"ai_providers",
		"user_roles",
		"user",
	]) {
		sqlite.exec(`DELETE FROM ${table}`);
	}
}

export async function seedProvider(
	db: AppDatabase,
	userId: string,
	enabled = true,
	apiKey = "enc:v1:iv:secret1234",
) {
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
		apiKey,
		enabled,
	});
	return providerId;
}
