import type { MessageFormatAdapter } from "@assistant-ui/core";
import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it } from "vitest";
import { createConversationHistoryAdapter } from "@/features/ai/stores/conversations-store/history-adapter";
import { conversationsStore } from "@/features/ai/stores/conversations-store/types";

const CONV_ID = "conv_test_1";

const testFormatAdapter: MessageFormatAdapter<
	UIMessage,
	{
		id: string;
		parentId: string | null;
		role: string;
		parts: UIMessage["parts"];
	}
> = {
	format: "test",
	getId: (message) => message.id,
	encode: ({ parentId, message }) => ({
		id: message.id,
		parentId,
		role: message.role,
		parts: message.parts,
	}),
	decode: (stored) => ({
		parentId: stored.content.parentId,
		message: {
			id: stored.content.id,
			role: stored.content.role as UIMessage["role"],
			parts: stored.content.parts,
		},
	}),
};

describe("createConversationHistoryAdapter", () => {
	beforeEach(() => {
		conversationsStore.setState((state) => ({
			...state,
			conversations: [],
			activeId: null,
			messagesMap: {},
			isHydrated: true,
			isHydrating: false,
			loadingConversationId: null,
		}));
	});

	it("loads stored messages via withFormat adapter", async () => {
		const messages: UIMessage[] = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
			{
				id: "m2",
				role: "assistant",
				parts: [{ type: "text", text: "Hi there" }],
			},
		];

		conversationsStore.setState((state) => ({
			...state,
			messagesMap: { [CONV_ID]: messages },
		}));

		const adapter = createConversationHistoryAdapter(() => CONV_ID);
		const formatted = adapter.withFormat!(testFormatAdapter);
		const loaded = await formatted.load();

		expect(loaded.messages).toHaveLength(2);
		expect(loaded.headId).toBe("m2");
		expect(loaded.messages[0]?.message).toMatchObject({
			id: "m1",
			role: "user",
		});
	});

	it("persists appended messages into the store", async () => {
		const adapter = createConversationHistoryAdapter(() => CONV_ID);
		const formatted = adapter.withFormat!(testFormatAdapter);
		const message: UIMessage = {
			id: "m1",
			role: "user",
			parts: [{ type: "text", text: "Persist me" }],
		};

		await formatted.append({
			parentId: null,
			message,
		});

		expect(conversationsStore.state.messagesMap[CONV_ID]).toEqual([message]);
	});
});
