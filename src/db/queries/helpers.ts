export function createId(): string {
	return crypto.randomUUID();
}

export const SEARCH_TEXT_LIMIT = 4096;

export function truncateSearchText(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, SEARCH_TEXT_LIMIT);
}

export function buildFileR2Key(
	userId: string,
	fileId: string,
	filename: string,
): string {
	const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
	return `users/${userId}/files/${fileId}-${safeName}`;
}
