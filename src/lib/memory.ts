import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { getMemoryBucket } from "../server-functions/storage";

const TABLE_SQL = [
	`CREATE TABLE IF NOT EXISTS memory_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    r2_key TEXT NOT NULL,
    search_text TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_profile_r2_key ON memory_profile (r2_key)`,
	`CREATE TABLE IF NOT EXISTS memory_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date TEXT NOT NULL,
    topic TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    duration INTEGER,
    r2_key TEXT NOT NULL,
    search_text TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE INDEX IF NOT EXISTS idx_memory_sessions_topic ON memory_sessions (topic)`,
	`CREATE TABLE IF NOT EXISTS memory_topic_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_slug TEXT NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    search_text TEXT NOT NULL DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_topic_notes_r2_key ON memory_topic_notes (r2_key)`,
	`CREATE INDEX IF NOT EXISTS idx_memory_topic_notes_topic ON memory_topic_notes (topic)`,
	`CREATE TABLE IF NOT EXISTS memory_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_type TEXT NOT NULL,
    name TEXT NOT NULL,
    topic TEXT,
    r2_key TEXT NOT NULL,
    search_text TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_documents_r2_key ON memory_documents (r2_key)`,
	`CREATE INDEX IF NOT EXISTS idx_memory_documents_type ON memory_documents (doc_type)`,
];

const PROFILE_KEY = "memory/profile.md";
const SEARCH_TEXT_LIMIT = 4000;

export interface QuizSessionData {
	examName: string;
	topic: string;
	totalQuestions: number;
	correctAnswers: number;
	questions: Array<{
		question: string;
		userAnswer: string;
		correctAnswer: string;
		isCorrect: boolean;
		explanation: string;
		topic: string;
	}>;
	duration?: number;
}

export interface MemoryContext {
	profileNotes: string;
	recentSessions: string;
	topicNotes: string;
	relevantSearchResults: string;
}

interface SearchResult {
	path: string;
	content: string;
}

interface SearchIndexRow {
	path: string;
	r2Key: string;
	searchText: string;
}

export interface MemoryOverview {
	profileNotes: string;
	recentSessions: Array<{
		id: number;
		sessionDate: string;
		topic: string;
		examName: string;
		totalQuestions: number;
		correctAnswers: number;
		accuracy: number;
		createdAt: string;
	}>;
	topicNotes: Array<{
		topic: string;
		updatedAt: string;
	}>;
	documents: Array<{
		id: number;
		type: string;
		name: string;
		topic: string | null;
		createdAt: string;
	}>;
}

export class MemoryManager {
	private ensureTablesPromise: Promise<void> | null = null;
	private bucketPromise: Promise<R2Bucket> | null = null;

	constructor(
		private db: D1Database,
		private bucket?: R2Bucket,
	) {}

	private async ensureTables(): Promise<void> {
		if (!this.ensureTablesPromise) {
			this.ensureTablesPromise = (async () => {
				for (const sql of TABLE_SQL) {
					await this.db.prepare(sql).run();
				}
			})();
		}
		await this.ensureTablesPromise;
	}

	private async getBucket(): Promise<R2Bucket> {
		if (this.bucket) {
			return this.bucket;
		}

		if (!this.bucketPromise) {
			this.bucketPromise = (async () => {
				const resolved = await getMemoryBucket();
				if (!resolved) {
					throw new Error("R2 MEMORY_BUCKET binding is not available");
				}
				this.bucket = resolved;
				return resolved;
			})();
		}

		return this.bucketPromise;
	}

	private sessionSlug(topic: string): string {
		return topic
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
	}

	private static toSearchText(content: string): string {
		return content.replace(/\s+/g, " ").trim().slice(0, SEARCH_TEXT_LIMIT);
	}

	private async writeToR2(key: string, content: string): Promise<void> {
		const bucket = await this.getBucket();
		await bucket.put(key, content, {
			httpMetadata: { contentType: "text/markdown; charset=utf-8" },
		});
	}

	private async readFromR2(key: string): Promise<string> {
		const bucket = await this.getBucket();
		const object = await bucket.get(key);
		if (!object) {
			return "";
		}
		return await object.text();
	}

	private async getProfileContent(): Promise<string> {
		await this.ensureTables();
		const row = await this.db
			.prepare("SELECT r2_key as r2Key FROM memory_profile WHERE id = 1")
			.first<{ r2Key: string }>();
		if (!row?.r2Key) {
			return "";
		}
		return await this.readFromR2(row.r2Key);
	}

	private async setProfileContent(content: string): Promise<void> {
		await this.ensureTables();
		await this.writeToR2(PROFILE_KEY, content);
		await this.db
			.prepare(
				`INSERT INTO memory_profile (id, r2_key, search_text, updated_at)
         VALUES (1, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           r2_key = excluded.r2_key,
           search_text = excluded.search_text,
           updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(PROFILE_KEY, MemoryManager.toSearchText(content))
			.run();
	}

	private async hydrateSearchResults(
		rows: SearchIndexRow[],
	): Promise<SearchResult[]> {
		const entries = await Promise.all(
			rows.map(async (row) => {
				const content = await this.readFromR2(row.r2Key);
				return {
					path: row.path,
					content: content || row.searchText,
				};
			}),
		);

		return entries.filter((entry) => entry.content.trim().length > 0);
	}

	async ensureStructure(): Promise<void> {
		await this.ensureTables();
	}

	async saveQuizSession(session: QuizSessionData): Promise<string> {
		await this.ensureTables();

		const now = new Date();
		const date = now.toISOString().slice(0, 10);
		const slug = this.sessionSlug(session.topic);
		const uniqueSuffix = now.toISOString().replace(/[:.]/g, "-");
		const fileName = `${date}-quiz-${slug}-${uniqueSuffix}.md`;
		const filePath = `memory/sessions/${fileName}`;
		const accuracy =
			session.totalQuestions > 0
				? Math.round((session.correctAnswers / session.totalQuestions) * 100)
				: 0;

		const content = `---
type: quiz-session
date: ${date}
topic: ${session.topic}
exam: ${session.examName}
total: ${session.totalQuestions}
correct: ${session.correctAnswers}
accuracy: ${accuracy}%
duration: ${session.duration ?? "N/A"}
---

# Quiz Session: ${session.topic}

**Date:** ${date}
**Exam:** ${session.examName}
**Score:** ${session.correctAnswers}/${session.totalQuestions} (${accuracy}%)

## Questions

${session.questions
	.map(
		(q, i) => `
### ${i + 1}. ${q.question}

- **Your answer:** ${q.userAnswer}
- **Correct answer:** ${q.correctAnswer}
- **Result:** ${q.isCorrect ? "Correct" : "Incorrect"}
- **Explanation:** ${q.explanation}
- **Topic:** ${q.topic}
`,
	)
	.join("\n")}

## Summary

- **Topics covered:** ${session.topic}
- **Accuracy:** ${accuracy}%
- **Total questions:** ${session.totalQuestions}
`;

		await this.writeToR2(filePath, content);

		await this.db
			.prepare(
				`INSERT INTO memory_sessions (
          session_date, topic, exam_name, total_questions, correct_answers,
          accuracy, duration, r2_key, search_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				date,
				session.topic,
				session.examName,
				session.totalQuestions,
				session.correctAnswers,
				accuracy,
				session.duration ?? null,
				filePath,
				MemoryManager.toSearchText(content),
			)
			.run();

		await this.updateProfile(session);
		return filePath;
	}

	private async updateProfile(session: QuizSessionData): Promise<void> {
		await this.ensureTables();
		let profile = await this.getProfileContent();
		if (!profile) {
			profile = `---
type: learning-profile
created: ${new Date().toISOString().slice(0, 10)}
---

# Learning Profile

## Topics Studied

## Recent Activity

## Strong Areas

## Weak Areas
`;
		}

		const today = new Date().toISOString().slice(0, 10);
		const accuracy =
			session.totalQuestions > 0
				? Math.round((session.correctAnswers / session.totalQuestions) * 100)
				: 0;

		const activityLine = `- ${today}: ${session.topic} - ${session.correctAnswers}/${session.totalQuestions} (${accuracy}%)`;
		const topicLine = `- [[${session.topic}]]`;

		if (!profile.includes(`- ${today}: ${session.topic}`)) {
			profile = profile.replace(
				"## Recent Activity",
				`## Recent Activity\n${activityLine}`,
			);
		}

		if (!profile.includes(topicLine)) {
			profile = profile.replace(
				"## Topics Studied",
				`## Topics Studied\n${topicLine}`,
			);
		}

		if (
			accuracy < 60 &&
			!profile.includes(`## Weak Areas\n- [[${session.topic}]]`)
		) {
			profile = profile.replace(
				"## Weak Areas",
				`## Weak Areas\n- [[${session.topic}]]`,
			);
		} else if (
			accuracy >= 80 &&
			!profile.includes(`## Strong Areas\n- [[${session.topic}]]`)
		) {
			profile = profile.replace(
				"## Strong Areas",
				`## Strong Areas\n- [[${session.topic}]]`,
			);
		}

		await this.setProfileContent(profile);
	}

	async saveTopicNotes(topic: string, content: string): Promise<string> {
		await this.ensureTables();
		const slug = this.sessionSlug(topic);
		const filePath = `memory/topics/${slug}.md`;

		const note = `---
type: topic-notes
topic: ${topic}
updated: ${new Date().toISOString().slice(0, 10)}
---

# ${topic}

${content}
`;

		await this.writeToR2(filePath, note);

		await this.db
			.prepare(
				`INSERT INTO memory_topic_notes (topic_slug, topic, r2_key, search_text, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(topic_slug) DO UPDATE SET
           topic = excluded.topic,
           r2_key = excluded.r2_key,
           search_text = excluded.search_text,
           updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(slug, topic, filePath, MemoryManager.toSearchText(note))
			.run();

		return filePath;
	}

	async exportQuestionsToVault(
		examName: string,
		topic: string,
		questions: Array<{
			question: string;
			options: string[];
			answer: string;
			explanation?: string;
		}>,
	): Promise<string> {
		await this.ensureTables();
		const slug = examName
			.replace(/[^a-z0-9]+/gi, "-")
			.toLowerCase()
			.replace(/(^-|-$)/g, "");
		const filePath = `questions/${slug}.md`;

		const content = `---
type: question-bank
source: ${examName}
topic: ${topic}
exported: ${new Date().toISOString().slice(0, 10)}
total: ${questions.length}
---

# ${examName}

## Questions (${questions.length})

${questions
	.map(
		(q, i) => `
### ${i + 1}. ${q.question}

${q.options.map((o, j) => `${String.fromCharCode(97 + j)}) ${o}`).join("\n")}

**Correct answer:** ${q.answer}
${q.explanation ? `**Explanation:** ${q.explanation}` : ""}
`,
	)
	.join("\n")}
`;

		await this.writeToR2(filePath, content);

		await this.db
			.prepare(
				`INSERT INTO memory_documents (doc_type, name, topic, r2_key, search_text)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(r2_key) DO UPDATE SET
           doc_type = excluded.doc_type,
           name = excluded.name,
           topic = excluded.topic,
           search_text = excluded.search_text`,
			)
			.bind(
				"question-bank",
				filePath,
				topic,
				filePath,
				MemoryManager.toSearchText(content),
			)
			.run();

		return filePath;
	}

	async search(query: string): Promise<SearchResult[]> {
		await this.ensureTables();
		const like = `%${query.trim()}%`;
		if (query.trim().length === 0) return [];

		const sessions = await this.db
			.prepare(
				`SELECT r2_key as path, r2_key as r2Key, search_text as searchText
         FROM memory_sessions
         WHERE topic LIKE ? OR exam_name LIKE ? OR search_text LIKE ?
         ORDER BY created_at DESC
         LIMIT 3`,
			)
			.bind(like, like, like)
			.all<SearchIndexRow>();

		const notes = await this.db
			.prepare(
				`SELECT r2_key as path, r2_key as r2Key, search_text as searchText
         FROM memory_topic_notes
         WHERE topic LIKE ? OR search_text LIKE ?
         ORDER BY updated_at DESC
         LIMIT 3`,
			)
			.bind(like, like)
			.all<SearchIndexRow>();

		const documents = await this.db
			.prepare(
				`SELECT name as path, r2_key as r2Key, search_text as searchText
         FROM memory_documents
         WHERE topic LIKE ? OR search_text LIKE ? OR name LIKE ?
         ORDER BY created_at DESC
         LIMIT 3`,
			)
			.bind(like, like, like)
			.all<SearchIndexRow>();

		return await this.hydrateSearchResults([
			...(sessions.results ?? []),
			...(notes.results ?? []),
			...(documents.results ?? []),
		]);
	}

	async getOverview(): Promise<MemoryOverview> {
		await this.ensureTables();

		const profileNotes = await this.getProfileContent();

		const sessionsRes = await this.db
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

		const topicNotesRes = await this.db
			.prepare(
				`SELECT
          topic,
          COALESCE(updated_at, CURRENT_TIMESTAMP) as updatedAt
         FROM memory_topic_notes
         ORDER BY updated_at DESC
         LIMIT 20`,
			)
			.all<MemoryOverview["topicNotes"][number]>();

		const documentsRes = await this.db
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

	async getMemoryContext(topics: string[]): Promise<MemoryContext> {
		await this.ensureTables();

		const profileNotes = await this.getProfileContent();

		const recentSessionsRes = await this.db
			.prepare(
				`SELECT r2_key as r2Key FROM memory_sessions
         ORDER BY created_at DESC
         LIMIT 5`,
			)
			.all<{ r2Key: string }>();

		const recentSessionContents = await Promise.all(
			(recentSessionsRes.results ?? []).map((r) => this.readFromR2(r.r2Key)),
		);

		const recentSessions = recentSessionContents
			.filter((content) => content.trim().length > 0)
			.join("\n\n---\n\n");

		const topicNotesChunks: string[] = [];
		for (const topic of topics) {
			const slug = this.sessionSlug(topic);
			const row = await this.db
				.prepare(
					`SELECT r2_key as r2Key
           FROM memory_topic_notes
           WHERE topic_slug = ?
           LIMIT 1`,
				)
				.bind(slug)
				.first<{ r2Key: string }>();
			if (row?.r2Key) {
				const content = await this.readFromR2(row.r2Key);
				if (content) {
					topicNotesChunks.push(content);
				}
			}
		}
		const topicNotes = topicNotesChunks.join("\n\n");

		const searchQuery = topics.join(" ").trim();
		let relevantSearchResults = "";
		if (searchQuery) {
			const results = await this.search(searchQuery);
			relevantSearchResults = results
				.slice(0, 3)
				.map((r) => `From [[${r.path}]]:\n${r.content.slice(0, 500)}`)
				.join("\n\n");
		}

		return { profileNotes, recentSessions, topicNotes, relevantSearchResults };
	}

	async buildMemoryPrompt(topics: string[]): Promise<string> {
		const ctx = await this.getMemoryContext(topics);
		const parts: string[] = [];

		if (ctx.profileNotes) {
			parts.push(
				`<user_profile>\n${ctx.profileNotes.slice(0, 1000)}\n</user_profile>`,
			);
		}

		if (ctx.recentSessions) {
			parts.push(
				`<recent_sessions>\n${ctx.recentSessions.slice(0, 2000)}\n</recent_sessions>`,
			);
		}

		if (ctx.topicNotes) {
			parts.push(
				`<topic_notes>\n${ctx.topicNotes.slice(0, 2000)}\n</topic_notes>`,
			);
		}

		if (ctx.relevantSearchResults) {
			parts.push(
				`<vault_search>\n${ctx.relevantSearchResults.slice(0, 2000)}\n</vault_search>`,
			);
		}

		return parts.join("\n\n");
	}

	async saveWebResearch(data: {
		query: string;
		summary: string;
		sources: string[];
		conclusion?: string;
		topic?: string | null;
		context?: "chat" | "ingest" | "reviewer";
	}): Promise<string> {
		await this.ensureTables();

		const now = new Date();
		const timestamp = now.toISOString();
		const safeSlug = this.sessionSlug(data.query).slice(0, 80) || "search";
		const unique = timestamp.replace(/[:.]/g, "-");
		const r2Key = `memory/research/${now.toISOString().slice(0, 10)}-${safeSlug}-${unique}.md`;
		const name = `research/${safeSlug}-${unique}.md`;
		const uniqueSources = Array.from(
			new Set(data.sources.map((source) => source.trim()).filter(Boolean)),
		);

		const content = `---
type: web-research
context: ${data.context ?? "chat"}
query: ${data.query}
timestamp: ${timestamp}
sources: ${uniqueSources.length}
topic: ${data.topic ?? "General"}
---

# Web Research

## Query
${data.query}

## Summary
${data.summary || "No summary provided."}

## Conclusion
${data.conclusion || "Best-effort evidence collected from web tools."}

## Sources
${uniqueSources.map((source) => `- ${source}`).join("\n") || "- none"}
`;

		await this.writeToR2(r2Key, content);

		await this.db
			.prepare(
				`INSERT INTO memory_documents (doc_type, name, topic, r2_key, search_text)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(r2_key) DO UPDATE SET
           doc_type = excluded.doc_type,
           name = excluded.name,
           topic = excluded.topic,
           search_text = excluded.search_text`,
			)
			.bind(
				"web-research",
				name,
				data.topic ?? null,
				r2Key,
				MemoryManager.toSearchText(
					`${data.query}\n${data.summary}\n${data.conclusion ?? ""}\n${uniqueSources.join("\n")}`,
				),
			)
			.run();

		return r2Key;
	}

	async saveStatsToVault(stats: {
		totalAttempts: number;
		correctAnswers: number;
		answeredQuestions: number;
		topics: Array<{
			topic: string;
			attempts: number;
			completedAnswers: number;
			correctAnswers: number;
			accuracy: number;
		}>;
	}): Promise<string> {
		await this.ensureTables();
		const date = new Date().toISOString().slice(0, 10);
		const filePath = "stats/progresso-geral.md";

		const content = `---
type: stats-snapshot
date: ${date}
totalAttempts: ${stats.totalAttempts}
topics: ${stats.topics.length}
---

# Progresso Geral

**Ultima atualizacao:** ${date}
**Total de tentativas:** ${stats.totalAttempts}

## Desempenho por Topico

| Topico | Tentativas | Resp. concluidas | Acertos | Aproveitamento |
|--------|-----------|------------------|---------|---------------|
${stats.topics.map((t) => `| ${t.topic} | ${t.attempts} | ${t.completedAnswers} | ${t.correctAnswers} | ${t.accuracy}% |`).join("\n")}

## Resumo

- **Topicos estudados:** ${stats.topics.length}
- **Media geral:** ${
			stats.answeredQuestions > 0
				? Math.round((stats.correctAnswers / stats.answeredQuestions) * 100)
				: 0
		}%
`;

		await this.writeToR2(filePath, content);

		await this.db
			.prepare(
				`INSERT INTO memory_documents (doc_type, name, topic, r2_key, search_text)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(r2_key) DO UPDATE SET
           doc_type = excluded.doc_type,
           name = excluded.name,
           topic = excluded.topic,
           search_text = excluded.search_text`,
			)
			.bind(
				"stats-snapshot",
				filePath,
				null,
				filePath,
				MemoryManager.toSearchText(content),
			)
			.run();

		return filePath;
	}
}
