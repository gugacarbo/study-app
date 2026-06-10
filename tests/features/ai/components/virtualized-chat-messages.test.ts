import { describe, expect, it } from "vitest";
import type { UIMessage } from "@tanstack/ai-client";
import {
	estimateMessageHeight,
	splitStreamingTail,
} from "@/features/ai/components/chat/virtualized-chat-messages";

function userMessage(content: string): UIMessage {
	return {
		id: "user-1",
		role: "user",
		parts: [{ type: "text", content }],
	};
}

function assistantMessage(parts: UIMessage["parts"]): UIMessage {
	return {
		id: "assistant-1",
		role: "assistant",
		parts,
	};
}

describe("splitStreamingTail", () => {
	it("keeps the streaming assistant message in the tail", () => {
		const messages = [
			userMessage("hello"),
			assistantMessage([{ type: "text", content: "thinking" }]),
		];

		expect(splitStreamingTail(messages, true)).toEqual({
			head: [messages[0]],
			tail: messages[1],
		});
	});

	it("keeps the full list when not loading", () => {
		const messages = [
			userMessage("hello"),
			assistantMessage([{ type: "text", content: "done" }]),
		];

		expect(splitStreamingTail(messages, false)).toEqual({
			head: messages,
			tail: null,
		});
	});
});

describe("estimateMessageHeight", () => {
	it("grows with longer user text", () => {
		const short = estimateMessageHeight(userMessage("hi"));
		const long = estimateMessageHeight(
			userMessage("a".repeat(240)),
		);
		expect(long).toBeGreaterThan(short);
	});

	it("accounts for assistant tool calls", () => {
		const textOnly = estimateMessageHeight(
			assistantMessage([{ type: "text", content: "done" }]),
		);
		const withTools = estimateMessageHeight(
			assistantMessage([
				{
					type: "tool-call",
					id: "tc-1",
					name: "search",
					arguments: "{}",
					state: "input-complete",
				},
				{
					type: "tool-result",
					toolCallId: "tc-1",
					content: "result",
					state: "complete",
				},
				{ type: "text", content: "done" },
			]),
		);
		expect(withTools).toBeGreaterThan(textOnly);
	});
});
