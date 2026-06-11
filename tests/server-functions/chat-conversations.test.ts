import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { DBQueries } from "@/db/queries";
import { ChatConversationStorage } from "@/lib/chat-conversations/storage";
import type { ChatConversationRecord } from "@/lib/chat-conversations/types";

function row(
	overrides: Partial<ChatConversationRecord> & Pick<ChatConversationRecord, "id">,
): ChatConversationRecord {
	return {
		title: "New Chat",
		r2_key: `chats/${overrides.id}.json`,
		message_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("chat-conversations server layer", () => {
	const rows = new Map<string, ChatConversationRecord>();
	let storage: ChatConversationStorage;

	beforeEach(() => {
		rows.clear();

		vi.spyOn(DBQueries.prototype, "listChatConversations").mockImplementation(
			async () => Array.from(rows.values()),
		);
		vi.spyOn(DBQueries.prototype, "getChatConversationById").mockImplementation(
			async (id: string) => rows.get(id) ?? null,
		);
		vi.spyOn(DBQueries.prototype, "insertChatConversation").mockImplementation(
			async (data) => {
				rows.set(
					data.id,
					row({
						id: data.id,
						title: data.title,
						r2_key: data.r2Key,
						message_count: data.messageCount ?? 0,
					}),
				);
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

		const mockR2 = {
			objects: new Map<string, string>(),
			put: vi.fn(async (key: string, value: string) => {
				mockR2.objects.set(key, value);
			}),
			get: vi.fn(async (key: string) => {
				const body = mockR2.objects.get(key);
				if (!body) return null;
				return { text: async () => body };
			}),
			delete: vi.fn(async (key: string) => {
				mockR2.objects.delete(key);
			}),
		};

		storage = new ChatConversationStorage({} as D1Database, mockR2 as never);
	});

	it("exposes list summaries for server listChatConversations", async () => {
		await storage.create("Listed");
		const conversations = await storage.list();
		expect(conversations).toHaveLength(1);
		expect(conversations[0]?.title).toBe("Listed");
	});

	it("exposes get for server getChatConversation", async () => {
		const created = await storage.create();
		const messages: UIMessage[] = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Hi" }] },
		];
		await storage.save(created.id, { messages });

		const loaded = await storage.get(created.id);
		expect(loaded.messages).toHaveLength(1);
	});

	it("exposes create for server createChatConversation", async () => {
		const created = await storage.create("Custom");
		expect(created.title).toBe("Custom");
	});

	it("exposes save for server saveChatConversation", async () => {
		const created = await storage.create();
		const messages: UIMessage[] = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Hi" }] },
		];
		const saved = await storage.save(created.id, { messages });
		expect(saved.messageCount).toBe(1);
	});

	it("exposes delete for server deleteChatConversation", async () => {
		const created = await storage.create();
		await storage.delete(created.id);
		await expect(storage.get(created.id)).rejects.toThrow(/not found/i);
	});
});

type D1Database = ConstructorParameters<typeof DBQueries>[0];
