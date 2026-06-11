import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ChatConversationStorage } from "@/lib/chat-conversations/storage";
import {
	fromStoredMessages,
	type StoredChatMessage,
	toStoredMessages,
} from "@/lib/chat-conversations/types";
import { getDB } from "./db";
import { getMemoryBucket } from "./storage";

type ServerContext = Parameters<typeof getDB>[0];

async function getStorage(ctx: ServerContext) {
	const db = await getDB(ctx);
	if (!db) throw new Error("D1 database not available");

	const bucket = await getMemoryBucket(
		ctx as Parameters<typeof getMemoryBucket>[0],
	);
	if (!bucket) throw new Error("MEMORY_BUCKET not available");

	return new ChatConversationStorage(db, bucket);
}

const jsonValueSchema: z.ZodType<
	import("@/lib/chat-conversations/types").JsonValue
> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema),
	]),
);

const storedMessageSchema = z.object({
	id: z.string(),
	role: z.string(),
	parts: z.array(jsonValueSchema),
	metadata: z.record(z.string(), jsonValueSchema).optional(),
});

export const listChatConversations = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const storage = await getStorage(ctx);
		const conversations = await storage.list();
		return { conversations };
	},
);

export const getChatConversation = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async (ctx) => {
		const { data } = ctx;
		const storage = await getStorage(ctx);
		const result = await storage.get(data.id);
		return {
			conversation: result.conversation,
			messages: toStoredMessages(result.messages),
		};
	});

export const createChatConversation = createServerFn({ method: "POST" })
	.inputValidator(z.object({ title: z.string().optional() }))
	.handler(async (ctx) => {
		const { data } = ctx;
		const storage = await getStorage(ctx);
		const conversation = await storage.create(data.title);
		return { conversation };
	});

export const saveChatConversation = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.string().min(1),
			title: z.string().optional(),
			messages: z.array(storedMessageSchema).optional(),
		}),
	)
	.handler(async (ctx) => {
		const { data } = ctx;
		const storage = await getStorage(ctx);
		const conversation = await storage.save(data.id, {
			title: data.title,
			messages:
				data.messages !== undefined
					? fromStoredMessages(data.messages as StoredChatMessage[])
					: undefined,
		});
		return { conversation };
	});

export const deleteChatConversation = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async (ctx) => {
		const { data } = ctx;
		const storage = await getStorage(ctx);
		await storage.delete(data.id);
		return { deleted: true as const };
	});
