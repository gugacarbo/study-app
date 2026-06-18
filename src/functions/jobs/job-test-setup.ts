import type { D1Database } from "@cloudflare/workers-types";
import { vi } from "vitest";
import { upsert as upsertModelQuery } from "@/db/queries/ai-models";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import { insert as insertProvider } from "@/db/queries/ai-providers";
import type { AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

const hoisted = vi.hoisted(() => ({
	testUserId: "00000000-0000-4000-8000-000000000091",
	otherUserId: "00000000-0000-4000-8000-000000000092",
}));

export const testUserId = hoisted.testUserId;
export const otherUserId = hoisted.otherUserId;
export const testDb = createTestDb();

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({} as D1Database)),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: vi.fn(() => testDb),
	};
});

vi.mock("@/lib/rbac", () => ({
	requireSession: vi.fn(async () => ({
		user: { id: hoisted.testUserId },
		session: { id: "session-1" },
	})),
}));

export function resetJobTestDb() {
	const sqlite = (
		testDb as unknown as { session: { client: { exec: (sql: string) => void } } }
	).session.client;
	for (const table of [
		"background_job_events",
		"background_jobs",
		"files",
		"questions",
		"exams",
		"config",
		"ai_models",
		"ai_providers",
		"user_roles",
		"user",
	]) {
		sqlite.exec(`DELETE FROM ${table}`);
	}
}

export async function seedUser(db: AppDatabase, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

export async function seedDefaultModel(db: AppDatabase, userId: string) {
	await seedUser(db, userId);
	const providerId = createId();
	await insertProvider(db, {
		id: providerId,
		userId,
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		apiKey: "enc:v1:iv:secret1234",
		enabled: true,
	});
	const modelRowId = createId();
	await upsertModelQuery(db, {
		id: modelRowId,
		providerId,
		modelId: "gpt-4o",
		displayName: "GPT-4o",
		enabled: true,
	});
	await setConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL, modelRowId);
	return modelRowId;
}

export async function seedExam(
	db: AppDatabase,
	userId: string,
	name = "Prova 1",
) {
	const examId = createId();
	await db.insert(schema.exams).values({
		id: examId,
		userId,
		name,
	});
	return examId;
}
