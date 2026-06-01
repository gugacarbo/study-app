import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const exams = sqliteTable("exams", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	source: text("source"),
	created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const questions = sqliteTable(
	"questions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		exam_id: integer("exam_id").references(() => exams.id, {
			onDelete: "cascade",
		}),
		question: text("question").notNull(),
		options: text("options").notNull(), // JSON array of strings
		answer: text("answer").notNull(),
		explanation: text("explanation"),
		deep_explanation: text("deep_explanation"),
		topic: text("topic"),
		created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_questions_exam_id").on(table.exam_id)],
);

export const attempts = sqliteTable(
	"attempts",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		question_id: integer("question_id").references(() => questions.id, {
			onDelete: "cascade",
		}),
		user_answer: text("user_answer").notNull(),
		correct: integer("correct", { mode: "boolean" }).notNull(),
		timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_attempts_question_id").on(table.question_id)],
);

export const files = sqliteTable(
	"files",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
			exam_id: integer("exam_id").references(() => exams.id, {
				onDelete: "cascade",
			}),
			name: text("name").notNull(),
			r2_key: text("r2_key").notNull(),
			mime_type: text("mime_type"),
			size: integer("size"),
			created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_files_exam_id").on(table.exam_id),
		uniqueIndex("uq_files_r2_key").on(table.r2_key),
	],
);

export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});

export const llmLogs = sqliteTable(
	"llm_logs",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		call_id: text("call_id").notNull(),
		call_type: text("call_type").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		base_url: text("base_url"),
		system_prompt: text("system_prompt"),
		request_payload: text("request_payload"),
		response_payload: text("response_payload"),
		duration_ms: integer("duration_ms"),
		chunks: integer("chunks"),
		final_chars: integer("final_chars"),
		token_meta: text("token_meta"),
		error_message: text("error_message"),
		status: text("status").notNull().default("pending"),
		created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_llm_logs_created_at").on(table.created_at),
		uniqueIndex("uq_llm_logs_call_id").on(table.call_id),
	],
);

export const memoryProfile = sqliteTable("memory_profile", {
	id: integer("id").primaryKey(),
	r2_key: text("r2_key").notNull(),
	search_text: text("search_text").notNull().default(""),
	updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_memory_profile_r2_key").on(table.r2_key)]);

export const memorySessions = sqliteTable(
	"memory_sessions",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		session_date: text("session_date").notNull(),
		topic: text("topic").notNull(),
		exam_name: text("exam_name").notNull(),
		total_questions: integer("total_questions").notNull(),
		correct_answers: integer("correct_answers").notNull(),
		accuracy: integer("accuracy").notNull(),
		duration: integer("duration"),
		r2_key: text("r2_key").notNull(),
		search_text: text("search_text").notNull().default(""),
		created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_memory_sessions_topic").on(table.topic)],
);

export const memoryTopicNotes = sqliteTable(
	"memory_topic_notes",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		topic_slug: text("topic_slug").notNull().unique(),
		topic: text("topic").notNull(),
		r2_key: text("r2_key").notNull(),
		search_text: text("search_text").notNull().default(""),
		updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_memory_topic_notes_topic").on(table.topic),
		uniqueIndex("uq_memory_topic_notes_r2_key").on(table.r2_key),
	],
);

export const memoryDocuments = sqliteTable(
	"memory_documents",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		doc_type: text("doc_type").notNull(),
		name: text("name").notNull(),
		topic: text("topic"),
		r2_key: text("r2_key").notNull(),
		search_text: text("search_text").notNull().default(""),
		created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_memory_documents_type").on(table.doc_type),
		uniqueIndex("uq_memory_documents_r2_key").on(table.r2_key),
	],
);
