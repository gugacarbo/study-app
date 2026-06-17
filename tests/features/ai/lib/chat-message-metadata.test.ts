import type { LanguageModelUsage } from "ai";
import { describe, expect, it } from "vitest";
import { extractChatMessageMetadata } from "@/features/ai/lib/chat-message-metadata";

const usage = {
	inputTokens: 1200,
	outputTokens: 80,
	totalTokens: 1280,
} as LanguageModelUsage;

describe("extractChatMessageMetadata", () => {
	it("maps finish totalUsage to message usage", () => {
		expect(
			extractChatMessageMetadata({
				type: "finish",
				finishReason: "stop",
				rawFinishReason: "stop",
				totalUsage: usage,
			}),
		).toEqual({
			usage,
		});
	});

	it("maps finish-step usage to steps metadata", () => {
		const stepUsage = {
			inputTokens: 500,
			outputTokens: 20,
			totalTokens: 520,
		} as LanguageModelUsage;

		expect(
			extractChatMessageMetadata({
				type: "finish-step",
				finishReason: "tool-calls",
				rawFinishReason: "tool_calls",
				usage: stepUsage,
				response: {
					id: "resp-1",
					timestamp: new Date(),
					modelId: "test-model",
				},
				providerMetadata: undefined,
			}),
		).toEqual({
			steps: [{ usage: stepUsage }],
		});
	});
});
