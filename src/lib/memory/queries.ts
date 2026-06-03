import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { readFromR2, sessionSlug } from "./r2-operations";
import { searchMemory } from "./search";
import type { MemoryContext, MemoryOverview, SearchResult } from "./types";

export async function getMemoryOverviewQuery(
	db: D1Database,
	getProfileContent: () => Promise<string>,
): Promise<MemoryOverview> {
	const profileNotes = await getProfileContent();

	const sessionsRes = await db
		.prepare(
			`SELECT
        id,
        session_date as sessionDate,
        topic,
        exam_name as examName,
        total_questions as totalQuestions,
        correct_answers as correctAnswers,
        accuracy,
        COALESCE(created_at, session_date) as createdAt
       FROM memory_sessions
       ORDER BY created_at DESC
       LIMIT 20`,
		)
		.all<MemoryOverview["recentSessions"][number]>();

	const topicNotesRes = await db
		.prepare(
			`SELECT
        topic,
        COALESCE(updated_at, CURRENT_TIMESTAMP) as updatedAt
       FROM memory_topic_notes
       ORDER BY updated_at DESC
       LIMIT 20`,
		)
		.all<MemoryOverview["topicNotes"][number]>();

	const documentsRes = await db
		.prepare(
			`SELECT
        id,
        doc_type as type,
        name,
        topic,
        COALESCE(created_at, CURRENT_TIMESTAMP) as createdAt
       FROM memory_documents
       ORDER BY created_at DESC
       LIMIT 20`,
		)
		.all<MemoryOverview["documents"][number]>();

	return {
		profileNotes,
		recentSessions: sessionsRes.results ?? [],
		topicNotes: topicNotesRes.results ?? [],
		documents: documentsRes.results ?? [],
	};
}

async function getRecentSessionContents(
	db: D1Database,
	bucket: R2Bucket,
): Promise<string> {
	const rows = await db
		.prepare(
			`SELECT r2_key as r2Key FROM memory_sessions
       ORDER BY created_at DESC
       LIMIT 5`,
		)
		.all<{ r2Key: string }>();

	const contents = await Promise.all(
		(rows.results ?? []).map((r) => readFromR2(bucket, r.r2Key)),
	);

	return contents
		.filter((content) => content.trim().length > 0)
		.join("\n\n---\n\n");
}

async function getTopicNoteContents(
	db: D1Database,
	bucket: R2Bucket,
	topics: string[],
): Promise<string> {
	const chunks: string[] = [];
	for (const topic of topics) {
		const slug = sessionSlug(topic);
		const row = await db
			.prepare(
				`SELECT r2_key as r2Key
         FROM memory_topic_notes
         WHERE topic_slug = ?
         LIMIT 1`,
			)
			.bind(slug)
			.first<{ r2Key: string }>();
		if (row?.r2Key) {
			const content = await readFromR2(bucket, row.r2Key);
			if (content) chunks.push(content);
		}
	}
	return chunks.join("\n\n");
}

export async function getMemoryContextQuery(
	db: D1Database,
	bucket: R2Bucket,
	topics: string[],
	getProfileContent: () => Promise<string>,
): Promise<MemoryContext> {
	const profileNotes = await getProfileContent();
	const recentSessions = await getRecentSessionContents(db, bucket);
	const topicNotes = await getTopicNoteContents(db, bucket, topics);

	const searchQuery = topics.join(" ").trim();
	let relevantSearchResults = "";
	if (searchQuery) {
		const results = await searchMemory(db, bucket, searchQuery);
		relevantSearchResults = results
			.slice(0, 3)
			.map(
				(r: SearchResult) => `From [[${r.path}]]:\n${r.content.slice(0, 500)}`,
			)
			.join("\n\n");
	}

	return { profileNotes, recentSessions, topicNotes, relevantSearchResults };
}
