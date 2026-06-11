import { describe, expect, it } from "vitest";
import {
	decryptSecret,
	encryptSecret,
	isEncryptedSecret,
} from "#/lib/config-encryption";

describe("config-encryption", () => {
	it("encrypts and decrypts a secret", async () => {
		const encrypted = await encryptSecret("sk-test-key-123");
		expect(isEncryptedSecret(encrypted)).toBe(true);
		expect(encrypted).not.toContain("sk-test-key-123");
		await expect(decryptSecret(encrypted)).resolves.toBe("sk-test-key-123");
	});

	it("returns legacy plaintext values unchanged", async () => {
		await expect(decryptSecret("sk-legacy-plaintext")).resolves.toBe(
			"sk-legacy-plaintext",
		);
	});
});
