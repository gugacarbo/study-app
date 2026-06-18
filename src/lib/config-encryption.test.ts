import { afterEach, describe, expect, it, vi } from "vitest";

const { TEST_KEY } = vi.hoisted(() => {
	const key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
	process.env.CONFIG_ENCRYPTION_KEY = key;
	return { TEST_KEY: key };
});

const { decryptSecret, encryptSecret, isEncryptedSecret } = await import(
	"@/lib/config-encryption"
);

describe("config-encryption", () => {
	afterEach(() => {
		process.env.CONFIG_ENCRYPTION_KEY = TEST_KEY;
	});

	it("isEncryptedSecret detects enc:v1 prefix", () => {
		expect(isEncryptedSecret("enc:v1:abc:def")).toBe(true);
		expect(isEncryptedSecret("sk-plaintext-key")).toBe(false);
	});

	it("encryptSecret produces enc:v1 format and decryptSecret round-trips", async () => {
		const plaintext = "sk-test-api-key-12345";
		const encrypted = await encryptSecret(plaintext);

		expect(encrypted.startsWith("enc:v1:")).toBe(true);
		expect(encrypted.split(":")).toHaveLength(4);
		expect(await decryptSecret(encrypted)).toBe(plaintext);
	});

	it("decryptSecret returns legacy plaintext unchanged", async () => {
		const legacy = "sk-legacy-plaintext-key";
		expect(await decryptSecret(legacy)).toBe(legacy);
	});

	it("throws when CONFIG_ENCRYPTION_KEY is missing", async () => {
		process.env.CONFIG_ENCRYPTION_KEY = "";
		vi.resetModules();
		const { encryptSecret: encryptWithoutKey } = await import(
			"@/lib/config-encryption"
		);

		await expect(encryptWithoutKey("secret")).rejects.toThrow(
			/CONFIG_ENCRYPTION_KEY is not configured/,
		);
	});

	it("throws when CONFIG_ENCRYPTION_KEY decodes to wrong length", async () => {
		process.env.CONFIG_ENCRYPTION_KEY = "dGVzdA==";
		vi.resetModules();
		const { encryptSecret: encryptWithBadKey } = await import(
			"@/lib/config-encryption"
		);

		await expect(encryptWithBadKey("secret")).rejects.toThrow(
			/must decode to exactly 32 bytes/,
		);
	});

	it("throws on malformed encrypted payload", async () => {
		await expect(decryptSecret("enc:v1:invalid")).rejects.toThrow(
			/Invalid encrypted secret format/,
		);
	});
});
