import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const chatConversations = sqliteTable(
	"chat_conversations",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		r2Key: text("r2_key").notNull(),
		messageCount: integer("message_count").notNull().default(0),
		contextKey: text("context_key"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_chat_conversations_user_updated").on(
			table.userId,
			table.updatedAt,
		),
		uniqueIndex("uq_chat_conversations_r2_key").on(table.r2Key),
	],
);
