import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DBQueries } from "@/db/queries";
import { ChatConversationStorage } from "@/lib/chat-conversations/storage";
import type { ChatConversationRecord } from "@/lib/chat-conversations/types";

function createMockR2() {
	const objects = new Map<string, string>();

	return {
		objects,
		put: vi.fn(async (key: string, value: string) => {
			objects.set(key, value);
		}),
		get: vi.fn(async (key: string) => {
			const body = objects.get(key);
			if (!body) return null;
			return { text: async () => body };
		}),
		delete: vi.fn(async (key: string) => {
			objects.delete(key);
		}),
	} as unknown as R2Bucket & { objects: Map<string, string> };
}

function row(
	overrides: Partial<ChatConversationRecord> & Pick<ChatConversationRecord, "id">,
): ChatConversationRecord {
	return {
		title: "New Chat",
		r2_key: `chats/${overrides.id}.json`,
		message_count: 0,
		context_key: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("ChatConversationStorage", () => {
	let mockR2: ReturnType<typeof createMockR2>;
	let storage: ChatConversationStorage;
	const rows = new Map<string, ChatConversationRecord>();

	beforeEach(() => {
		rows.clear();
		mockR2 = createMockR2();

		vi.spyOn(DBQueries.prototype, "listChatConversations").mockImplementation(
			async () => Array.from(rows.values()),
		);
		vi.spyOn(DBQueries.prototype, "getChatConversationById").mockImplementation(
			async (id: string) => rows.get(id) ?? null,
		);
		vi.spyOn(DBQueries.prototype, "insertChatConversation").mockImplementation(
			async (data) => {
				rows.set(data.id, row({
					id: data.id,
					title: data.title,
					r2_key: data.r2Key,
					message_count: data.messageCount ?? 0,
					context_key: data.contextKey ?? null,
				}));
			},
		);
		vi.spyOn(DBQueries.prototype, "updateChatConversation").mockImplementation(
			async (id, data) => {
				const existing = rows.get(id);
				if (!existing) return;
				rows.set(id, {
					...existing,
					title: data.title ?? existing.title,
					message_count: data.messageCount ?? existing.message_count,
					updated_at: "2026-01-02T00:00:00Z",
				});
			},
		);
		vi.spyOn(DBQueries.prototype, "deleteChatConversation").mockImplementation(
			async (id) => {
				rows.delete(id);
			},
		);

		storage = new ChatConversationStorage({} as D1Database, mockR2);
	});

	it("creates a conversation with empty messages in R2", async () => {
		const conversation = await storage.create("Test chat");
		expect(conversation.title).toBe("Test chat");
		expect(conversation.messageCount).toBe(0);
		expect(mockR2.objects.has(`chats/${conversation.id}.json`)).toBe(true);
	});

	it("saves and retrieves messages", async () => {
		const created = await storage.create();
		const messages: UIMessage[] = [
			{
				id: "m1",
				role: "user",
				parts: [{ type: "text", text: "Hello" }],
			},
		];

		await storage.save(created.id, { messages });
		const loaded = await storage.get(created.id);

		expect(loaded.messages).toEqual(messages);
		expect(loaded.conversation.messageCount).toBe(1);
	});

	it("lists conversations", async () => {
		const first = await storage.create("First");
		const second = await storage.create("Second");
		const list = await storage.list();

		expect(list.map((item) => item.id).sort()).toEqual(
			[first.id, second.id].sort(),
		);
	});

	it("deletes conversation from D1 and R2", async () => {
		const created = await storage.create();
		const r2Key = `chats/${created.id}.json`;

		await storage.delete(created.id);

		expect(mockR2.objects.has(r2Key)).toBe(false);
		await expect(storage.get(created.id)).rejects.toThrow(/not found/i);
	});
});
