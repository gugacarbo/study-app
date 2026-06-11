import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
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
		answers: text("answers").notNull(), // JSON array of correct option strings
		scoring_mode: text("scoring_mode").notNull().default("exact"),
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
		exam_id: integer("exam_id").references(() => exams.id, {
			onDelete: "cascade",
		}),
		topic: text("topic"),
		total_questions: integer("total_questions").notNull(),
		answered_questions: integer("answered_questions").notNull().default(0),
		correct_answers: real("correct_answers").notNull().default(0),
		status: text("status").notNull().default("in_progress"),
		started_at: text("started_at").default(sql`CURRENT_TIMESTAMP`),
		completed_at: text("completed_at"),
		updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_attempts_exam_id").on(table.exam_id),
		index("idx_attempts_status").on(table.status),
	],
);

export const attemptAnswers = sqliteTable(
	"attempt_answers",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		attempt_id: integer("attempt_id")
			.notNull()
			.references(() => attempts.id, {
				onDelete: "cascade",
			}),
		question_id: integer("question_id")
			.notNull()
			.references(() => questions.id, {
				onDelete: "cascade",
			}),
		user_answer: text("user_answer").notNull(),
		correct: integer("correct", { mode: "boolean" }).notNull(),
		credit: real("credit"),
		answered_at: text("answered_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_attempt_answers_attempt_id").on(table.attempt_id),
		index("idx_attempt_answers_question_id").on(table.question_id),
		uniqueIndex("uq_attempt_answers_attempt_question").on(
			table.attempt_id,
			table.question_id,
		),
	],
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

export const aiProviders = sqliteTable("ai_providers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	base_url: text("base_url").notNull(),
	api_key: text("api_key").notNull(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const aiModels = sqliteTable(
	"ai_models",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		provider_id: integer("provider_id")
			.notNull()
			.references(() => aiProviders.id, { onDelete: "cascade" }),
		model_id: text("model_id").notNull(),
		display_name: text("display_name").notNull(),
		context_window: integer("context_window"),
		max_output_tokens: integer("max_output_tokens"),
		input_cost_per_million: real("input_cost_per_million"),
		output_cost_per_million: real("output_cost_per_million"),
		thinking_effort_levels: text("thinking_effort_levels"),
		default_thinking_effort: text("default_thinking_effort"),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		metadata: text("metadata"),
		created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_ai_models_provider_id").on(table.provider_id),
		uniqueIndex("uq_ai_models_provider_model").on(
			table.provider_id,
			table.model_id,
		),
	],
);

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

export const memoryProfile = sqliteTable(
	"memory_profile",
	{
		id: integer("id").primaryKey(),
		r2_key: text("r2_key").notNull(),
		search_text: text("search_text").notNull().default(""),
		updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [uniqueIndex("uq_memory_profile_r2_key").on(table.r2_key)],
);

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
