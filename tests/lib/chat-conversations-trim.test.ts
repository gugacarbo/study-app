import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "@/lib/chat-conversations/constants";
import {
	mergeMessagesForSave,
	trimMessagesForRuntime,
} from "@/lib/chat-conversations/trim";

function message(id: string): UIMessage {
	return { id, role: "user", parts: [{ type: "text", text: id }] };
}

describe("trimMessagesForRuntime", () => {
	it("returns all messages when under limit", () => {
		const messages = [message("a"), message("b")];
		expect(trimMessagesForRuntime(messages, 80)).toEqual(messages);
	});

	it("keeps only the last N messages", () => {
		const messages = Array.from({ length: 100 }, (_, i) =>
			message(`m${i}`),
		);
		const trimmed = trimMessagesForRuntime(messages, CHAT_RUNTIME_MESSAGE_LIMIT);
		expect(trimmed).toHaveLength(CHAT_RUNTIME_MESSAGE_LIMIT);
		expect(trimmed[0]?.id).toBe("m20");
	});
});

describe("mergeMessagesForSave", () => {
	it("replaces overlapping suffix with runtime window", () => {
		const full = [message("a"), message("b"), message("c")];
		const window = [message("b"), message("c"), message("d")];
		expect(mergeMessagesForSave(full, window)).toEqual([
			message("a"),
			message("b"),
			message("c"),
			message("d"),
		]);
	});

	it("returns runtime window when full history is empty", () => {
		const window = [message("a")];
		expect(mergeMessagesForSave([], window)).toEqual(window);
	});
});
