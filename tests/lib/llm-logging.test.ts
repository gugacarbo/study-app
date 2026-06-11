import type { LanguageModelUsage } from "ai";
import { describe, expect, it } from "vitest";
import {
	buildLlmLogInsert,
	createLlmLogCallId,
	serializeFinishEvent,
} from "@/lib/llm-logging";

const sampleUsage: LanguageModelUsage = {
	inputTokens: 1,
	outputTokens: 2,
	totalTokens: 3,
	inputTokenDetails: {
		noCacheTokens: 1,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	},
	outputTokenDetails: {
		textTokens: 2,
		reasoningTokens: 0,
	},
};

describe("llm-logging", () => {
	it("creates stable call id prefixes", () => {
		const callId = createLlmLogCallId("chat", "abc");
		expect(callId.startsWith("chat-abc-")).toBe(true);
	});

	it("redacts text when content logging is disabled by default in tests", () => {
		const payload = serializeFinishEvent(
			{
				text: "secret answer",
				finishReason: "stop",
				usage: sampleUsage,
				steps: [],
			},
			false,
		);

		expect(payload.text).toBe("[13 chars redacted]");
	});

	it("builds insert payload with token metadata", () => {
		const startedAt = Date.now() - 120;
		const log = buildLlmLogInsert(
			{
				callType: "chat",
				callId: "chat-1",
				provider: "OpenRouter",
				model: "test/model",
				baseUrl: "https://openrouter.ai/api/v1",
			},
			{
				status: "success",
				startedAt,
				finish: {
					text: "hello",
					finishReason: "stop",
					usage: {
						...sampleUsage,
						inputTokens: 10,
						outputTokens: 5,
						totalTokens: 15,
					},
					totalUsage: {
						...sampleUsage,
						inputTokens: 10,
						outputTokens: 5,
						totalTokens: 15,
					},
				},
			},
		);

		expect(log.callId).toBe("chat-1");
		expect(log.status).toBe("success");
		expect(log.durationMs).toBeGreaterThanOrEqual(120);
		expect(log.tokenMeta).toContain("inputTokens");
	});
});
