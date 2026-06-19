import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const llmLogs = sqliteTable(
	"llm_logs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		callId: text("call_id").notNull(),
		callType: text("call_type").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		baseUrl: text("base_url"),
		systemPrompt: text("system_prompt"),
		requestPayload: text("request_payload"),
		responsePayload: text("response_payload"),
		durationMs: integer("duration_ms"),
		chunks: integer("chunks"),
		finalChars: integer("final_chars"),
		tokenMeta: text("token_meta"),
		errorMessage: text("error_message"),
		status: text("status").notNull().default("pending"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_llm_logs_user_created").on(table.userId, table.createdAt),
		uniqueIndex("uq_llm_logs_call_id").on(table.callId),
	],
);

export const r2OperationLogs = sqliteTable(
	"r2_operation_logs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		bucket: text("bucket").notNull(),
		operation: text("operation").notNull(),
		objectKey: text("object_key").notNull(),
		bytes: integer("bytes"),
		status: text("status").notNull(),
		durationMs: integer("duration_ms"),
		errorMessage: text("error_message"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_r2_operation_logs_user_created").on(
			table.userId,
			table.createdAt,
		),
		index("idx_r2_operation_logs_bucket_created").on(
			table.bucket,
			table.createdAt,
		),
	],
);
