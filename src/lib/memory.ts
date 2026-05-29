import type { D1Database } from "@cloudflare/workers-types";

const TABLE_SQL = [
	`CREATE TABLE IF NOT EXISTS memory_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE TABLE IF NOT EXISTS memory_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date TEXT NOT NULL,
    topic TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    duration INTEGER,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE TABLE IF NOT EXISTS memory_topic_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_slug TEXT NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
	`CREATE TABLE IF NOT EXISTS memory_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_type TEXT NOT NULL,
    name TEXT NOT NULL,
    topic TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
];

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

	constructor(private db: D1Database) {}

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

	private sessionSlug(topic: string): string {
		return topic
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
	}

	private async getProfileContent(): Promise<string> {
		await this.ensureTables();
		const row = await this.db
			.prepare("SELECT content FROM memory_profile WHERE id = 1")
			.first<{ content: string }>();
		return row?.content ?? "";
	}

	private async setProfileContent(content: string): Promise<void> {
		await this.ensureTables();
		await this.db
			.prepare(
				`INSERT INTO memory_profile (id, content, updated_at)
         VALUES (1, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           content = excluded.content,
           updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(content)
			.run();
	}

	async ensureStructure(): Promise<void> {
		await this.ensureTables();
	}

	async saveQuizSession(session: QuizSessionData): Promise<string> {
		await this.ensureTables();

		const date = new Date().toISOString().slice(0, 10);
		const slug = this.sessionSlug(session.topic);
		const fileName = `${date}-quiz-${slug}.md`;
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
- **Result:** ${q.isCorrect ? "✅ Correct" : "❌ Incorrect"}
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

		await this.db
			.prepare(
				`INSERT INTO memory_sessions (
          session_date, topic, exam_name, total_questions, correct_answers,
          accuracy, duration, content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				date,
				session.topic,
				session.examName,
				session.totalQuestions,
				session.correctAnswers,
				accuracy,
				session.duration ?? null,
				content,
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

		await this.db
			.prepare(
				`INSERT INTO memory_topic_notes (topic_slug, topic, content, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(topic_slug) DO UPDATE SET
           topic = excluded.topic,
           content = excluded.content,
           updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(slug, topic, note)
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

		await this.db
			.prepare(
				`INSERT INTO memory_documents (doc_type, name, topic, content)
         VALUES (?, ?, ?, ?)`,
			)
			.bind("question-bank", filePath, topic, content)
			.run();

		return filePath;
	}

	async search(query: string): Promise<SearchResult[]> {
		await this.ensureTables();
		const like = `%${query.trim()}%`;
		if (query.trim().length === 0) return [];

		const sessions = await this.db
			.prepare(
				`SELECT 'memory/sessions' as path, content
         FROM memory_sessions
         WHERE topic LIKE ? OR exam_name LIKE ? OR content LIKE ?
         ORDER BY created_at DESC
         LIMIT 3`,
			)
			.bind(like, like, like)
			.all<{ path: string; content: string }>();

		const notes = await this.db
			.prepare(
				`SELECT 'memory/topics/' || topic_slug || '.md' as path, content
         FROM memory_topic_notes
         WHERE topic LIKE ? OR content LIKE ?
         ORDER BY updated_at DESC
         LIMIT 3`,
			)
			.bind(like, like)
			.all<{ path: string; content: string }>();

		const documents = await this.db
			.prepare(
				`SELECT name as path, content
         FROM memory_documents
         WHERE topic LIKE ? OR content LIKE ?
         ORDER BY created_at DESC
         LIMIT 3`,
			)
			.bind(like, like)
			.all<{ path: string; content: string }>();

		return [
			...(sessions.results ?? []),
			...(notes.results ?? []),
			...(documents.results ?? []),
		];
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
				`SELECT content FROM memory_sessions
         ORDER BY created_at DESC
         LIMIT 5`,
			)
			.all<{ content: string }>();

		const recentSessions = (recentSessionsRes.results ?? [])
			.map((r) => r.content)
			.filter(Boolean)
			.join("\n\n---\n\n");

		const topicNotesChunks: string[] = [];
		for (const topic of topics) {
			const slug = this.sessionSlug(topic);
			const row = await this.db
				.prepare(
					`SELECT content
           FROM memory_topic_notes
           WHERE topic_slug = ?
           LIMIT 1`,
				)
				.bind(slug)
				.first<{ content: string }>();
			if (row?.content) {
				topicNotesChunks.push(row.content);
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

	async saveStatsToVault(stats: {
		totalAttempts: number;
		topics: Array<{
			topic: string;
			total: number;
			correct: number;
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

**Última atualização:** ${date}
**Total de tentativas:** ${stats.totalAttempts}

## Desempenho por Tópico

| Tópico | Tentativas | Acertos | Aproveitamento |
|--------|-----------|---------|---------------|
${stats.topics.map((t) => `| ${t.topic} | ${t.total} | ${t.correct} | ${t.accuracy}% |`).join("\n")}

## Resumo

- **Tópicos estudados:** ${stats.topics.length}
- **Média geral:** ${
			stats.totalAttempts > 0
				? Math.round(
						(stats.topics.reduce((acc, t) => acc + t.correct, 0) /
							stats.totalAttempts) *
							100,
					)
				: 0
		}%
`;

		await this.db
			.prepare(
				`INSERT INTO memory_documents (doc_type, name, content)
         VALUES (?, ?, ?)`,
			)
			.bind("stats-snapshot", filePath, content)
			.run();

		return filePath;
	}
}

export function createMemoryManager(db: D1Database) {
	return new MemoryManager(db);
}
