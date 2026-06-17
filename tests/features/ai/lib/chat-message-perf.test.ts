import type { MessageTiming } from "@assistant-ui/core";
import { describe, expect, it } from "vitest";
import {
	attachChatMessagePerf,
	buildChatMessagePerf,
	enrichMessagesWithChatPerf,
	formatChatMessagePerfLine,
	formatChatMessagePerfTime,
	getAssistantMessagePerfView,
	mergePreservedChatPerf,
} from "@/features/ai/lib/chat-message-perf";
import {
	fromStoredMessages,
	toStoredMessages,
} from "@/lib/chat-conversations/types";

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
			completedAtMs: 5_000,
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

	it("formats a compact perf line with all metrics", () => {
		const completedAtMs = Date.parse("2026-06-16T14:32:00");

		expect(
			formatChatMessagePerfLine({
				outputTokens: 281,
				totalRequestMs: 12_400,
				tokensPerSecond: 23,
				completedAtMs,
				hasData: true,
			}),
		).toBe(
			`281 saída · 12.4s lat. · 23 tok/s · ${formatChatMessagePerfTime(completedAtMs)}`,
		);
	});

	it("falls back to timing metadata for latency and rate", () => {
		expect(
			getAssistantMessagePerfView({
				metadata: {
					usage: { outputTokens: 100 },
					timing: {
						streamStartTime: 1_000,
						totalStreamTime: 2_000,
						totalChunks: 2,
						toolCallCount: 0,
						tokensPerSecond: 40,
					},
				},
				role: "assistant",
			}),
		).toMatchObject({
			outputTokens: 100,
			totalRequestMs: 2_000,
			tokensPerSecond: 50,
			completedAtMs: 3_000,
			hasData: true,
		});
	});

	it("persists tok/s through storage round-trip and reload view", () => {
		const timing: MessageTiming = {
			streamStartTime: 1_000,
			totalStreamTime: 4_000,
			totalChunks: 3,
			toolCallCount: 0,
		};

		const [enriched] = enrichMessagesWithChatPerf(
			[
				{
					id: "a1",
					role: "assistant",
					parts: [{ type: "text", text: "Resposta" }],
					metadata: { usage: { outputTokens: 200 } },
				},
			],
			{ a1: timing },
		);

		const [stored] = fromStoredMessages(toStoredMessages([enriched]));

		expect(
			getAssistantMessagePerfView({
				metadata: stored.metadata as Record<string, unknown>,
				role: "assistant",
			}),
		).toMatchObject({
			outputTokens: 200,
			totalRequestMs: 4_000,
			tokensPerSecond: 50,
			hasData: true,
		});

		expect(formatChatMessagePerfLine(
			getAssistantMessagePerfView({
				metadata: stored.metadata as Record<string, unknown>,
				role: "assistant",
			}),
		)).toContain("50 tok/s");
	});

	it("recomputes tok/s after enrich when usage arrives later on reload", () => {
		const [withLatencyOnly] = enrichMessagesWithChatPerf(
			[
				{
					id: "a1",
					role: "assistant",
					parts: [{ type: "text", text: "Resposta" }],
				},
			],
			{
				a1: {
					streamStartTime: 1,
					totalStreamTime: 2_000,
					totalChunks: 1,
					toolCallCount: 0,
				},
			},
		);

		const reloaded = {
			...withLatencyOnly,
			metadata: {
				...(withLatencyOnly.metadata as Record<string, unknown>),
				usage: { outputTokens: 100 },
			},
		};

		expect(
			getAssistantMessagePerfView({
				metadata: reloaded.metadata as Record<string, unknown>,
				role: "assistant",
			}),
		).toMatchObject({
			outputTokens: 100,
			totalRequestMs: 2_000,
			tokensPerSecond: 50,
		});
	});

	it("preserves saved perf when history overwrites the message", () => {
		const existing = attachChatMessagePerf(
			{
				id: "a1",
				role: "assistant",
				parts: [{ type: "text", text: "Antes" }],
			},
			{
				outputTokens: 120,
				totalRequestMs: 3_000,
				tokensPerSecond: 40,
				completedAtMs: 4_000,
			},
		);

		const merged = mergePreservedChatPerf(existing, {
			id: "a1",
			role: "assistant",
			parts: [{ type: "text", text: "Depois" }],
			metadata: { usage: { outputTokens: 120 } },
		});

		expect(
			getAssistantMessagePerfView({
				metadata: merged.metadata as Record<string, unknown>,
				role: "assistant",
			}),
		).toMatchObject({
			outputTokens: 120,
			totalRequestMs: 3_000,
			tokensPerSecond: 40,
		});
	});
});
