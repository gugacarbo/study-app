import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const memoryProfile = sqliteTable("memory_profile", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	r2Key: text("r2_key").notNull(),
	searchText: text("search_text").notNull().default(""),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const memorySessions = sqliteTable(
	"memory_sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sessionDate: text("session_date").notNull(),
		topic: text("topic").notNull(),
		examName: text("exam_name").notNull(),
		totalQuestions: integer("total_questions").notNull(),
		correctAnswers: integer("correct_answers").notNull(),
		accuracy: integer("accuracy").notNull(),
		duration: integer("duration"),
		r2Key: text("r2_key").notNull(),
		searchText: text("search_text").notNull().default(""),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_memory_sessions_user_topic").on(table.userId, table.topic),
	],
);

export const memoryTopicNotes = sqliteTable(
	"memory_topic_notes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		topicSlug: text("topic_slug").notNull(),
		topic: text("topic").notNull(),
		r2Key: text("r2_key").notNull(),
		searchText: text("search_text").notNull().default(""),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("uq_memory_topic_notes_user_slug").on(
			table.userId,
			table.topicSlug,
		),
	],
);

export const memoryDocuments = sqliteTable(
	"memory_documents",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		docType: text("doc_type").notNull(),
		name: text("name").notNull(),
		topic: text("topic"),
		r2Key: text("r2_key").notNull(),
		searchText: text("search_text").notNull().default(""),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_memory_documents_user_type").on(table.userId, table.docType),
	],
);
