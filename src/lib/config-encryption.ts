import { env } from "@/env";

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = "enc:v1:";

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
	const encoded = env.CONFIG_ENCRYPTION_KEY;
	if (!encoded) {
		throw new Error(
			"CONFIG_ENCRYPTION_KEY is not configured. Add it to your .env file.",
		);
	}

	const raw = base64ToBytes(encoded);
	if (raw.length !== 32) {
		throw new Error(
			"CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes (use: openssl rand -base64 32).",
		);
	}

	const keyBytes = new Uint8Array(raw);
	return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, [
		"encrypt",
		"decrypt",
	]);
}

export function isEncryptedSecret(value: string): boolean {
	return value.startsWith(ENCRYPTED_PREFIX);
}

export async function encryptSecret(plaintext: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const key = await getEncryptionKey();
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv },
		key,
		encoded,
	);

	return `${ENCRYPTED_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(stored: string): Promise<string> {
	if (!isEncryptedSecret(stored)) {
		return stored;
	}

	const payload = stored.slice(ENCRYPTED_PREFIX.length);
	const separator = payload.indexOf(":");
	if (separator < 0) {
		throw new Error("Invalid encrypted secret format");
	}

	const iv = base64ToBytes(payload.slice(0, separator));
	const ciphertext = base64ToBytes(payload.slice(separator + 1));
	const key = await getEncryptionKey();
	const decrypted = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv: new Uint8Array(iv) },
		key,
		new Uint8Array(ciphertext),
	);

	return new TextDecoder().decode(decrypted);
}
