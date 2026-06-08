import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateJsonStreamMock } = vi.hoisted(() => ({
	generateJsonStreamMock: vi.fn(),
}));

vi.mock("@/features/ai/core/generate", () => ({
	generateJsonStream: generateJsonStreamMock,
}));

import { reviewSingleQuestion } from "@/features/ai/agents/ingest/review-extraction/review-question";

describe("reviewSingleQuestion", () => {
	beforeEach(() => {
		generateJsonStreamMock.mockReset();
	});

	it("streams text, tool events, and token events through the reviewer contract", async () => {
		generateJsonStreamMock.mockImplementation(
			async (_config, _prompt, _schema, options) => {
				options?.onChunk?.({
					type: "TEXT_MESSAGE_CONTENT",
					delta: "Analisando a questao...",
				});
				options?.onChunk?.({
					type: "TOOL_CALL_END",
					toolCallId: "tool-1",
					toolCallName: "web_search",
					input: { query: "cache memory" },
					result: {
						ok: true,
						results: [{ title: "Cache", url: "https://example.com" }],
					},
				});
				options?.onChunk?.({
					type: "RUN_FINISHED",
					threadId: "thread-1",
					runId: "run-1",
					finishReason: "stop",
					usage: {
						promptTokens: 12,
						completionTokens: 8,
						totalTokens: 20,
					},
				});

				return {
					question: "O que e cache?",
					options: ["Memoria rapida", "Disco"],
					answer: "Memoria rapida",
					explanation: "",
					topic: "Arquitetura",
				};
			},
		);

		const onAgentEvent = vi.fn();
		const tools = [{ name: "web_search", execute: vi.fn() }] as unknown[];

		const result = await reviewSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			0,
			1,
			{
				reviewTopics: ["Arquitetura"],
				tools: tools as never,
				onAgentEvent,
				createAgentRunId: () => "review-q1",
			},
		);

		expect(result).toEqual({
			question: {
				question: "O que e cache?",
				options: ["Memoria rapida", "Disco"],
				answer: "Memoria rapida",
				explanation: "",
				topic: "Arquitetura",
			},
			success: true,
		});
		expect(generateJsonStreamMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("Review extracted question #1."),
			expect.anything(),
			expect.objectContaining({
				tools,
				system: expect.stringContaining("You are a reviewer for a single extracted exam question."),
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "pending",
				agentRunId: "review-q1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "running",
				agentRunId: "review-q1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				eventType: "tool-call",
				agentRunId: "review-q1",
				name: "web_search",
				arguments: JSON.stringify({ query: "cache memory" }),
				input: { query: "cache memory" },
				output: {
					ok: true,
					results: [{ title: "Cache", url: "https://example.com" }],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({
				eventType: "tool-result",
				agentRunId: "review-q1",
				content: {
					ok: true,
					results: [{ title: "Cache", url: "https://example.com" }],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			5,
			expect.objectContaining({
				eventType: "token",
				agentRunId: "review-q1",
				tokens: {
					promptTokens: 12,
					completionTokens: 8,
					totalTokens: 20,
				},
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			6,
			expect.objectContaining({
				eventType: "result",
				agentRunId: "review-q1",
				rawText:
					'Analisando a questao...\n[tool:web_search] input={"query":"cache memory"} result={"ok":true,"results":[{"title":"Cache","url":"https://example.com"}]}',
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			7,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "done",
				agentRunId: "review-q1",
			}),
		);
	});
});
