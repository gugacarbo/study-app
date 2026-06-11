import { desc, eq, sql } from "drizzle-orm";
import type { ChatConversationRecord } from "@/lib/chat-conversations/types";
import * as schema from "../schema";
import type { DBQueries } from "./base";

export function listChatConversations(
	this: DBQueries,
): Promise<ChatConversationRecord[]> {
	return this.db
		.select()
		.from(schema.chatConversations)
		.orderBy(desc(schema.chatConversations.updated_at))
		.all() as Promise<ChatConversationRecord[]>;
}

export function getChatConversationById(
	this: DBQueries,
	id: string,
): Promise<ChatConversationRecord | null> {
	return this.db
		.select()
		.from(schema.chatConversations)
		.where(eq(schema.chatConversations.id, id))
		.get()
		.then((row) => (row as ChatConversationRecord | undefined) ?? null);
}

export function insertChatConversation(
	this: DBQueries,
	data: {
		id: string;
		title: string;
		r2Key: string;
		messageCount?: number;
	},
): Promise<void> {
	return this.db
		.insert(schema.chatConversations)
		.values({
			id: data.id,
			title: data.title,
			r2_key: data.r2Key,
			message_count: data.messageCount ?? 0,
		})
		.run()
		.then(() => undefined);
}

export function updateChatConversation(
	this: DBQueries,
	id: string,
	data: {
		title?: string;
		messageCount?: number;
	},
): Promise<void> {
	const updates: {
		title?: string;
		message_count?: number;
		updated_at: ReturnType<typeof sql>;
	} = {
		updated_at: sql`CURRENT_TIMESTAMP`,
	};

	if (data.title !== undefined) updates.title = data.title;
	if (data.messageCount !== undefined) {
		updates.message_count = data.messageCount;
	}

	return this.db
		.update(schema.chatConversations)
		.set(updates)
		.where(eq(schema.chatConversations.id, id))
		.run()
		.then(() => undefined);
}

export function deleteChatConversation(
	this: DBQueries,
	id: string,
): Promise<void> {
	return this.db
		.delete(schema.chatConversations)
		.where(eq(schema.chatConversations.id, id))
		.run()
		.then(() => undefined);
}
