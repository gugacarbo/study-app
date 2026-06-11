import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { UIMessage } from "ai";
import { DBQueries } from "@/db/queries";
import {
	type ChatConversationPayload,
	type ChatConversationRecord,
	type ChatConversationSummary,
	fromStoredMessages,
	toStoredMessages,
} from "./types";

function buildR2Key(id: string): string {
	return `chats/${id}.json`;
}

function toSummary(row: ChatConversationRecord): ChatConversationSummary {
	return {
		id: row.id,
		title: row.title,
		messageCount: row.message_count,
		createdAt: row.created_at ?? "",
		updatedAt: row.updated_at ?? "",
	};
}

function generateConversationId(): string {
	return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function readPayload(
	bucket: R2Bucket,
	r2Key: string,
): Promise<ChatConversationPayload> {
	const object = await bucket.get(r2Key);
	if (!object) return { messages: [] };

	try {
		const parsed = JSON.parse(await object.text()) as ChatConversationPayload;
		if (parsed && Array.isArray(parsed.messages)) {
			return { messages: parsed.messages };
		}
	} catch {
		// corrupt payload
	}

	return { messages: [] };
}

async function writePayload(
	bucket: R2Bucket,
	r2Key: string,
	payload: ChatConversationPayload,
): Promise<void> {
	await bucket.put(r2Key, JSON.stringify(payload), {
		httpMetadata: { contentType: "application/json; charset=utf-8" },
	});
}

export class ChatConversationStorage {
	private queries: DBQueries;
	private bucket: R2Bucket;

	constructor(d1: D1Database, bucket: R2Bucket) {
		this.queries = new DBQueries(d1);
		this.bucket = bucket;
	}

	async list(): Promise<ChatConversationSummary[]> {
		const rows = await this.queries.listChatConversations();
		return rows.map(toSummary);
	}

	async get(
		id: string,
	): Promise<{ conversation: ChatConversationSummary; messages: UIMessage[] }> {
		const row = await this.queries.getChatConversationById(id);
		if (!row) throw new Error(`Conversation not found: ${id}`);

		const payload = await readPayload(this.bucket, row.r2_key);
		return {
			conversation: toSummary(row),
			messages: fromStoredMessages(payload.messages),
		};
	}

	async create(title = "New Chat"): Promise<ChatConversationSummary> {
		const id = generateConversationId();
		const r2Key = buildR2Key(id);

		await writePayload(this.bucket, r2Key, { messages: [] });
		await this.queries.insertChatConversation({
			id,
			title,
			r2Key,
			messageCount: 0,
		});

		const row = await this.queries.getChatConversationById(id);
		if (!row) throw new Error("Failed to create conversation");
		return toSummary(row);
	}

	async save(
		id: string,
		data: { title?: string; messages?: UIMessage[] },
	): Promise<ChatConversationSummary> {
		const row = await this.queries.getChatConversationById(id);
		if (!row) throw new Error(`Conversation not found: ${id}`);

		if (data.messages !== undefined) {
			await writePayload(this.bucket, row.r2_key, {
				messages: toStoredMessages(data.messages),
			});
			await this.queries.updateChatConversation(id, {
				title: data.title,
				messageCount: data.messages.length,
			});
		} else if (data.title !== undefined) {
			await this.queries.updateChatConversation(id, { title: data.title });
		}

		const updated = await this.queries.getChatConversationById(id);
		if (!updated) throw new Error(`Conversation not found: ${id}`);
		return toSummary(updated);
	}

	async delete(id: string): Promise<void> {
		const row = await this.queries.getChatConversationById(id);
		if (!row) return;

		await this.bucket.delete(row.r2_key);
		await this.queries.deleteChatConversation(id);
	}
}
