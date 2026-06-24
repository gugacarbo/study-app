import { beforeEach, describe, expect, it, vi } from "vitest";
import { getByIdForUser } from "@/db/queries/ai-providers";
import {
	adminUserId,
	resetAdminTestDb,
	seedProvider,
	testDb,
} from "@/functions/admin/admin-test-setup";
import { fetchOpenAiModelIds, probeProvider } from "@/functions/admin/helpers";
import {
	createProviderHandler,
	discoverModelsHandler,
	listProvidersHandler,
	testProviderHandler,
} from "@/functions/admin/providers";
import { createProviderSchema } from "@/functions/admin/providers-schemas";

vi.mock("@/lib/config-encryption", () => ({
	encryptSecret: vi.fn(async (value: string) => `enc:${value}`),
	decryptSecret: vi.fn(async (value: string) =>
		value.startsWith("enc:") ? value.slice(4) : value,
	),
	isEncryptedSecret: vi.fn((value: string) => value.startsWith("enc:")),
}));

vi.mock("@/functions/admin/helpers", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/functions/admin/helpers")>();
	return {
		...actual,
		probeProvider: vi.fn(actual.probeProvider),
		fetchOpenAiModelIds: vi.fn(actual.fetchOpenAiModelIds),
	};
});

import { encryptSecret } from "@/lib/config-encryption";

describe("admin providers handlers", () => {
	beforeEach(() => {
		resetAdminTestDb();
		vi.clearAllMocks();
	});

	it("listProviders returns masked keys without plaintext", async () => {
		const providerId = await seedProvider(
			testDb,
			adminUserId,
			true,
			"enc:v1:iv:cipher-key12",
		);
		const rows = await listProvidersHandler(new Headers());
		expect(rows).toEqual([
			{
				id: providerId,
				name: "OpenAI",
				baseUrl: "https://api.openai.com/v1",
				enabled: true,
				apiKeyMasked: "••••ey12",
				hasApiKey: true,
			},
		]);
		expect(JSON.stringify(rows)).not.toContain("cipher-key12");
	});

	it("createProvider encrypts api key and strips trailing slash", async () => {
		await seedProvider(testDb, adminUserId);
		const result = await createProviderHandler(
			createProviderSchema.parse({
				name: "Groq",
				baseUrl: "https://api.groq.com/openai/v1/",
				apiKey: "gsk-secret",
			}),
			new Headers(),
		);
		expect(encryptSecret).toHaveBeenCalledWith("gsk-secret");
		const stored = await getByIdForUser(testDb, result.id, adminUserId);
		expect(stored?.apiKey).toBe("enc:gsk-secret");
		expect(stored?.baseUrl).toBe("https://api.groq.com/openai/v1");
	});

	it("testProvider probes stored provider credentials", async () => {
		const providerId = await seedProvider(
			testDb,
			adminUserId,
			true,
			"enc:secret-key",
		);
		vi.mocked(probeProvider).mockResolvedValueOnce({
			ok: true,
			statusCode: 200,
			latencyMs: 120,
			models: ["gpt-4o", "gpt-4o-mini"],
		});
		const result = await testProviderHandler({ id: providerId }, new Headers());
		expect(probeProvider).toHaveBeenCalledWith(
			"https://api.openai.com/v1",
			"secret-key",
		);
		expect(result).toEqual({
			ok: true,
			providerId,
			providerName: "OpenAI",
			baseUrl: "https://api.openai.com/v1",
			statusCode: 200,
			latencyMs: 120,
			models: ["gpt-4o", "gpt-4o-mini"],
		});
	});

	it("discoverModels returns OpenAI-compat model suggestions", async () => {
		const providerId = await seedProvider(
			testDb,
			adminUserId,
			true,
			"enc:secret-key",
		);
		vi.mocked(fetchOpenAiModelIds).mockResolvedValueOnce([
			"gpt-4o",
			"gpt-4o-mini",
		]);
		const result = await discoverModelsHandler({ providerId }, new Headers());
		expect(fetchOpenAiModelIds).toHaveBeenCalledWith(
			"https://api.openai.com/v1",
			"secret-key",
		);
		expect(result).toEqual({
			models: [
				{ modelId: "gpt-4o", displayName: "gpt-4o" },
				{ modelId: "gpt-4o-mini", displayName: "gpt-4o-mini" },
			],
		});
	});
});
