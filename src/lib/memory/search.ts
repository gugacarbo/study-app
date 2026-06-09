import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { readFromR2 } from "./r2-operations";
import type { SearchIndexRow, SearchResult } from "./types";

async function hydrateSearchResults(
	bucket: R2Bucket,
	rows: SearchIndexRow[],
): Promise<SearchResult[]> {
	const entries = await Promise.all(
		rows.map(async (row) => {
			const content = await readFromR2(bucket, row.r2Key);
			return { path: row.path, content: content || row.searchText };
		}),
	);
	return entries.filter((entry) => entry.content.trim().length > 0);
}

export async function searchMemory(
	db: D1Database,
	bucket: R2Bucket,
	query: string,
	limitPerSource = 3,
): Promise<SearchResult[]> {
	const like = `%${query.trim()}%`;
	if (query.trim().length === 0) return [];

	const sessions = await db
		.prepare(
			`SELECT r2_key as path, r2_key as r2Key, search_text as searchText
       FROM memory_sessions
       WHERE topic LIKE ? OR exam_name LIKE ? OR search_text LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
		)
		.bind(like, like, like, limitPerSource)
		.all<SearchIndexRow>();

	const notes = await db
		.prepare(
			`SELECT r2_key as path, r2_key as r2Key, search_text as searchText
       FROM memory_topic_notes
       WHERE topic LIKE ? OR search_text LIKE ?
       ORDER BY updated_at DESC
       LIMIT ?`,
		)
		.bind(like, like, limitPerSource)
		.all<SearchIndexRow>();

	const documents = await db
		.prepare(
			`SELECT name as path, r2_key as r2Key, search_text as searchText
       FROM memory_documents
       WHERE topic LIKE ? OR search_text LIKE ? OR name LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
		)
		.bind(like, like, like, limitPerSource)
		.all<SearchIndexRow>();

	return hydrateSearchResults(bucket, [
		...(sessions.results ?? []),
		...(notes.results ?? []),
		...(documents.results ?? []),
	]);
}
