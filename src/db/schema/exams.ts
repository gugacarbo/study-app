import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const exams = sqliteTable(
	"exams",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		source: text("source"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_exams_user_id").on(table.userId),
		index("idx_exams_user_created").on(table.userId, table.createdAt),
	],
);

export const questionTopics = sqliteTable(
	"question_topics",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		normalizedName: text("normalized_name").notNull(),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("uq_question_topics_normalized_name").on(
			table.normalizedName,
		),
	],
);

export const questions = sqliteTable(
	"questions",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		question: text("question").notNull(),
		options: text("options").notNull(),
		answers: text("answers").notNull(),
		scoringMode: text("scoring_mode").notNull().default("exact"),
		explanation: text("explanation"),
		deepExplanation: text("deep_explanation"),
		topic: text("topic"),
		topicId: text("topic_id").references(() => questionTopics.id, {
			onDelete: "set null",
		}),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_questions_exam_id").on(table.examId),
		index("idx_questions_topic_id").on(table.topicId),
	],
);

export const questionImprovementDrafts = sqliteTable(
	"question_improvement_drafts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		jobId: text("job_id").notNull(),
		status: text("status").notNull().default("pending_review"),
		originalSnapshot: text("original_snapshot").notNull(),
		improvedSnapshot: text("improved_snapshot").notNull(),
		summary: text("summary"),
		metadata: text("metadata"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_question_improvement_drafts_exam").on(table.examId, table.status),
		index("idx_question_improvement_drafts_question").on(
			table.questionId,
			table.status,
		),
	],
);

export const attempts = sqliteTable(
	"attempts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		config: text("config").notNull().default("{}"),
		topic: text("topic"),
		totalQuestions: integer("total_questions").notNull(),
		answeredQuestions: integer("answered_questions").notNull().default(0),
		correctAnswers: real("correct_answers").notNull().default(0),
		status: text("status").notNull().default("in_progress"),
		startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`),
		completedAt: text("completed_at"),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_attempts_user_id").on(table.userId),
		index("idx_attempts_exam_id").on(table.examId),
		index("idx_attempts_user_exam_status").on(
			table.userId,
			table.examId,
			table.status,
		),
		index("idx_attempts_status").on(table.status),
	],
);

export const attemptAnswers = sqliteTable(
	"attempt_answers",
	{
		id: text("id").primaryKey(),
		attemptId: text("attempt_id")
			.notNull()
			.references(() => attempts.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		userAnswer: text("user_answer").notNull(),
		correct: integer("correct", { mode: "boolean" }).notNull(),
		credit: real("credit"),
		answeredAt: text("answered_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_attempt_answers_attempt_id").on(table.attemptId),
		index("idx_attempt_answers_question_id").on(table.questionId),
		uniqueIndex("uq_attempt_answers_attempt_question").on(
			table.attemptId,
			table.questionId,
		),
	],
);

export const files = sqliteTable(
	"files",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		r2Key: text("r2_key").notNull(),
		mimeType: text("mime_type"),
		size: integer("size"),
		ttlSeconds: integer("ttl_seconds").notNull().default(0),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_files_exam_id").on(table.examId),
		uniqueIndex("uq_files_r2_key").on(table.r2Key),
		index("idx_files_ttl_purge").on(table.ttlSeconds, table.createdAt),
	],
);
