import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { insert as insertProvider } from "@/db/queries/ai-providers";
import { upsert as upsertModel } from "@/db/queries/ai-models";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	getConfigValue,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import { assignRoleToUser } from "@/db/queries/rbac";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { AppDatabase } from "@/db/client";
import { setDefaultModelHandler } from "@/functions/admin/models";
import { deleteModelHandler } from "@/functions/admin/models";
import {
	deleteProviderHandler,
	discoverModelsHandler,
	testProviderHandler,
	updateProviderHandler,
} from "@/functions/admin/providers";
import { setUserRoleHandler } from "@/functions/admin/users";
import { getAiModel } from "@/lib/ai-config";

const { mockRequireAdminSession } = vi.hoisted(() => ({
	mockRequireAdminSession: vi.fn(),
}));

let testDb: AppDatabase;
let adminUserId: string;
const headers = new Headers();

vi.mock("@/lib/rbac", () => ({
	requireAdminSession: mockRequireAdminSession,
}));

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

vi.mock("@/lib/config-encryption", () => ({
	encryptSecret: vi.fn(async (plaintext: string) => `enc:${plaintext}`),
	decryptSecret: vi.fn(async (stored: string) =>
		stored.startsWith("enc:") ? stored.slice(4) : stored,
	),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function seedAdminUser() {
	adminUserId = createId();
	await testDb.insert(schema.user).values({
		id: adminUserId,
		name: "Admin",
		email: `admin-${adminUserId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
	await assignRoleToUser(testDb, adminUserId, "admin");
	mockRequireAdminSession.mockResolvedValue({ user: { id: adminUserId } });
}

async function seedProviderWithModel(options?: { providerEnabled?: boolean }) {
	const providerId = createId();
	const modelRowId = createId();
	const ciphertext = "enc:original-key-1234";

	await insertProvider(testDb, {
		id: providerId,
		userId: adminUserId,
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		apiKey: ciphertext,
		enabled: options?.providerEnabled ?? true,
	});
	await upsertModel(testDb, {
		id: modelRowId,
		providerId,
		modelId: "gpt-4o",
		displayName: "GPT-4o",
		enabled: true,
	});

	return { providerId, modelRowId, ciphertext };
}

describe("admin handler edge cases (SPEC-0003)", () => {
	beforeEach(() => {
		testDb = createTestDb();
		mockFetch.mockReset();
	});

	it("#1 update provider without apiKey keeps ciphertext", async () => {
		await seedAdminUser();
		const { providerId, ciphertext } = await seedProviderWithModel();

		await updateProviderHandler(
			{ id: providerId, name: "Renamed Provider" },
			headers,
		);

		const rows = await testDb
			.select()
			.from(schema.aiProviders)
			.where(eq(schema.aiProviders.id, providerId));
		expect(rows[0]?.apiKey).toBe(ciphertext);
		expect(rows[0]?.name).toBe("Renamed Provider");
	});

	it("#2 delete provider clears default when cascade removes default model", async () => {
		await seedAdminUser();
		const { providerId, modelRowId } = await seedProviderWithModel();
		await setConfigValue(
			testDb,
			adminUserId,
			CONFIG_KEY_DEFAULT_AI_MODEL,
			modelRowId,
		);

		await deleteProviderHandler({ id: providerId }, headers);

		expect(
			await getConfigValue(
				testDb,
				adminUserId,
				CONFIG_KEY_DEFAULT_AI_MODEL,
			),
		).toBeNull();
	});

	it("#3 delete model clears default", async () => {
		await seedAdminUser();
		const { modelRowId } = await seedProviderWithModel();
		await setConfigValue(
			testDb,
			adminUserId,
			CONFIG_KEY_DEFAULT_AI_MODEL,
			modelRowId,
		);

		await deleteModelHandler({ id: modelRowId }, headers);

		expect(
			await getConfigValue(
				testDb,
				adminUserId,
				CONFIG_KEY_DEFAULT_AI_MODEL,
			),
		).toBeNull();
	});

	it("#4 setDefaultModel rejects disabled model", async () => {
		await seedAdminUser();
		const { providerId, modelRowId } = await seedProviderWithModel();
		await upsertModel(testDb, {
			id: modelRowId,
			providerId,
			modelId: "gpt-4o",
			displayName: "GPT-4o",
			enabled: false,
		});

		await expect(
			setDefaultModelHandler({ modelId: modelRowId }, headers),
		).rejects.toMatchObject({ status: 400 });
	});

	it("#4b setDefaultModel rejects disabled provider", async () => {
		await seedAdminUser();
		const { modelRowId } = await seedProviderWithModel({
			providerEnabled: false,
		});

		await expect(
			setDefaultModelHandler({ modelId: modelRowId }, headers),
		).rejects.toMatchObject({ status: 400 });
	});

	it("#5 discoverModels rejects disabled provider", async () => {
		await seedAdminUser();
		const { providerId } = await seedProviderWithModel({
			providerEnabled: false,
		});

		await expect(
			discoverModelsHandler({ providerId }, headers),
		).rejects.toMatchObject({ status: 400 });
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("#6 testProvider with invalid baseUrl returns ok:false without throw", async () => {
		await seedAdminUser();
		const providerId = createId();
		await insertProvider(testDb, {
			id: providerId,
			userId: adminUserId,
			name: "Broken",
			baseUrl: "http://foo bar/v1",
			apiKey: "enc:secret",
			enabled: true,
		});

		const result = await testProviderHandler({ id: providerId }, headers);

		expect(result).toEqual({ ok: false, error: expect.any(String) });
	});

	it("#8 setUserRole rejects role outside seed catalog", async () => {
		await seedAdminUser();
		const targetId = createId();
		await testDb.insert(schema.user).values({
			id: targetId,
			name: "Target",
			email: `target-${targetId}@aluno.ifsc.edu.br`,
			emailVerified: true,
		});

		await expect(
			setUserRoleHandler(
				{ userId: targetId, roleKey: "superadmin", action: "add" },
				headers,
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("#9 last admin cannot remove own admin role", async () => {
		await seedAdminUser();

		await expect(
			setUserRoleHandler(
				{ userId: adminUserId, roleKey: "admin", action: "remove" },
				headers,
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("#10 getAiModel without default throws a clear error", async () => {
		await seedAdminUser();
		await seedProviderWithModel();

		await expect(getAiModel({ db: testDb, userId: adminUserId })).rejects.toThrow(
			/Nenhum modelo padrão configurado/,
		);
	});
});
