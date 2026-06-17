import type { MessageTiming } from "@assistant-ui/core";
import { describe, expect, it } from "vitest";
import {
	buildChatMessagePerf,
	enrichMessagesWithChatPerf,
	formatChatMessagePerfLine,
	getAssistantMessagePerfView,
} from "@/features/ai/lib/chat-message-perf";

describe("chat-message-perf", () => {
	it("builds perf from usage and timing", () => {
		expect(
			buildChatMessagePerf({
				usageSource: {
					role: "assistant",
					metadata: { usage: { inputTokens: 100, outputTokens: 200 } },
				},
				timing: {
					streamStartTime: 1_000,
					totalStreamTime: 4_000,
					totalChunks: 3,
					toolCallCount: 0,
				},
			}),
		).toEqual({
			outputTokens: 200,
			totalRequestMs: 4_000,
			tokensPerSecond: 50,
		});
	});

	it("enriches assistant messages with saved perf", () => {
		const timing: MessageTiming = {
			streamStartTime: 1,
			totalStreamTime: 2_000,
			totalChunks: 1,
			toolCallCount: 0,
		};

		const [message] = enrichMessagesWithChatPerf(
			[
				{
					id: "a1",
					role: "assistant",
					parts: [{ type: "text", text: "Oi" }],
					metadata: { usage: { outputTokens: 12 } },
				},
			],
			{ a1: timing },
		);

		expect(
			getAssistantMessagePerfView({
				metadata: message.metadata as Record<string, unknown>,
				role: "assistant",
			}),
		).toMatchObject({
				outputTokens: 12,
				totalRequestMs: 2_000,
				tokensPerSecond: 6,
				hasData: true,
			});
	});

	it("formats a compact perf line", () => {
		expect(
			formatChatMessagePerfLine({
				outputTokens: 281,
				totalRequestMs: 12_400,
				tokensPerSecond: 23,
				hasData: true,
			}),
		).toBe("281 saída · 12.4s · 23 tok/s");
	});
});
