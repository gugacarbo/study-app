import type { R2Bucket } from "@cloudflare/workers-types";

export const PROFILE_KEY = "memory/profile.md";
const SEARCH_TEXT_LIMIT = 4000;

export function toSearchText(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, SEARCH_TEXT_LIMIT);
}

export function sessionSlug(topic: string): string {
	return topic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

export async function writeToR2(
	bucket: R2Bucket,
	key: string,
	content: string,
): Promise<void> {
	await bucket.put(key, content, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});
}

export async function readFromR2(
	bucket: R2Bucket,
	key: string,
): Promise<string> {
	const object = await bucket.get(key);
	if (!object) return "";
	return await object.text();
}
