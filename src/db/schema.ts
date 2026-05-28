import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";

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
		content: blob("content", { mode: "buffer" }).notNull(),
		mime_type: text("mime_type"),
		size: integer("size"),
		created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_files_exam_id").on(table.exam_id)],
);

export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});
