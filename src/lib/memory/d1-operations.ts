import type { D1Database } from "@cloudflare/workers-types";
import { PROFILE_KEY, toSearchText } from "./r2-operations";
import type { QuizSessionData } from "./types";

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

export async function ensureTables(db: D1Database): Promise<void> {
	for (const sql of TABLE_SQL) {
		await db.prepare(sql).run();
	}
}

export async function getProfileRow(
	db: D1Database,
): Promise<{ r2Key: string } | null> {
	const row = await db
		.prepare("SELECT r2_key as r2Key FROM memory_profile WHERE id = 1")
		.first<{ r2Key: string }>();
	return row ?? null;
}

export async function setProfileRow(
	db: D1Database,
	content: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO memory_profile (id, r2_key, search_text, updated_at)
       VALUES (1, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         r2_key = excluded.r2_key,
         search_text = excluded.search_text,
         updated_at = CURRENT_TIMESTAMP`,
		)
		.bind(PROFILE_KEY, toSearchText(content))
		.run();
}

export async function insertSession(
	db: D1Database,
	session: QuizSessionData,
	filePath: string,
	accuracy: number,
	date: string,
): Promise<void> {
	await db
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
			toSearchText(
				`${session.topic} ${session.examName} ${session.questions.map((q) => `${q.question} ${q.explanation}`).join(" ")}`,
			),
		)
		.run();
}

export async function upsertTopicNote(
	db: D1Database,
	slug: string,
	topic: string,
	filePath: string,
	noteContent: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO memory_topic_notes (topic_slug, topic, r2_key, search_text, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(topic_slug) DO UPDATE SET
         topic = excluded.topic,
         r2_key = excluded.r2_key,
         search_text = excluded.search_text,
         updated_at = CURRENT_TIMESTAMP`,
		)
		.bind(slug, topic, filePath, toSearchText(noteContent))
		.run();
}

export async function upsertDocument(
	db: D1Database,
	docType: string,
	name: string,
	topic: string | null,
	filePath: string,
	searchText: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO memory_documents (doc_type, name, topic, r2_key, search_text)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(r2_key) DO UPDATE SET
         doc_type = excluded.doc_type,
         name = excluded.name,
         topic = excluded.topic,
         search_text = excluded.search_text`,
		)
		.bind(docType, name, topic, filePath, toSearchText(searchText))
		.run();
}
