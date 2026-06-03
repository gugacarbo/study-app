import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { chatMock } = vi.hoisted(() => ({
	chatMock: vi.fn(),
}));

vi.mock("@tanstack/ai", () => ({
	chat: chatMock,
}));

vi.mock("@/features/ai/adapters/provider-adapter", () => ({
	getAiAdapter: vi.fn(() => "mock-adapter"),
}));

import { generateJsonStream } from "@/features/ai/core/generate";

describe("generateJsonStream", () => {
	beforeEach(() => {
		chatMock.mockReset();
	});

	it("builds fallback JSON from delta chunks instead of accumulated content", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '{"name":"Jo',
					content: '{"name":"Jo',
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: 'hn"}',
					content: '{"name":"John"}',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({
				name: z.string(),
			}),
		);

		expect(result).toEqual({ name: "John" });
	});

	it("strips unclosed think tags and extracts JSON", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '<think>Let me reason about this...\nThe answer is:',
					content: '<think>Let me reason about this...\nThe answer is:',
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '\n{"name":"Alice"}',
					content: '\n{"name":"Alice"}',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Alice" });
	});

	it("extracts JSON from code fences in fallback", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: 'Here is the JSON:\n```json\n{"name":"Bob"}\n```\nDone.',
					content: 'Here is the JSON:\n```json\n{"name":"Bob"}\n```\nDone.',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Bob" });
	});

	it("repairs trailing commas in JSON before parsing", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '{"items":["a","b",],"name":"test",}',
					content: '{"items":["a","b",],"name":"test",}',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ items: z.array(z.string()), name: z.string() }),
		);

		expect(result).toEqual({ items: ["a", "b"], name: "test" });
	});

	it("repairs single-quoted JSON keys in fallback", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "{'name':'Charlie'}",
					content: "{'name':'Charlie'}",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Charlie" });
	});

	it("includes detailed validation errors in thrown error message", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '{"wrong_key":"value"}',
					content: '{"wrong_key":"value"}',
				};
			})(),
		);

		await expect(
			generateJsonStream(
				{
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "test-key",
					baseUrl: "",
				},
				"Return JSON",
				z.object({ name: z.string() }),
			),
		).rejects.toThrow(/Structured output stream ended/);
	});

	it("recovers from structured-output-parse-failed RUN_ERROR by extracting JSON from think-block content", async () => {
		// Reasoning models (DeepSeek R1, Qwen QwQ) emit `<think>...</think>`
		// inline with the final JSON. The TanStack AI library surfaces this
		// as a synthetic RUN_ERROR with code 'structured-output-parse-failed'
		// because JSON.parse() can't handle the leading think block. Our
		// code should treat that error as recoverable and try the fallback
		// JSON extractor on the accumulated text.
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "TEXT_MESSAGE_START",
					messageId: "m1",
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "<think>Let me analyze the questions carefully.\n",
					content: "<think>Let me analyze the questions carefully.\n",
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: 'I need to extract them as JSON.\n</think>\n{"name":"Recovered"}',
					content: 'I need to extract them as JSON.\n</think>\n{"name":"Recovered"}',
				};
				yield { type: "TEXT_MESSAGE_END", messageId: "m1" };
				yield {
					type: "CUSTOM",
					name: "structured-output.start",
					value: { messageId: "m1" },
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						'Failed to parse structured output as JSON. Content: <think>Let me analyze...',
					code: "structured-output-parse-failed",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "deepseek/deepseek-r1",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Recovered" });
	});

	it("recovers from structured-output-parse-failed RUN_ERROR when think-wrapped JSON arrives as reasoning chunks", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "REASONING_MESSAGE_CONTENT",
					delta: "<think>Let me analyze this carefully.\n",
				};
				yield {
					type: "REASONING_MESSAGE_CONTENT",
					delta: 'I will now return the object.\n</think>\n{"name":"Reasoned"}',
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						"Failed to parse structured output as JSON from reasoning content.",
					code: "structured-output-parse-failed",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "deepseek/deepseek-r1",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Reasoned" });
	});

	it("throws when structured-output-parse-failed RUN_ERROR has no recoverable JSON", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "<think>I refuse to answer as JSON</think>",
					content: "<think>I refuse to answer as JSON</think>",
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message: "Failed to parse structured output as JSON.",
					code: "structured-output-parse-failed",
				};
			})(),
		);

		await expect(
			generateJsonStream(
				{
					provider: "openrouter",
					model: "deepseek/deepseek-r1",
					apiKey: "test-key",
					baseUrl: "",
				},
				"Return JSON",
				z.object({ name: z.string() }),
			),
		).rejects.toThrow(/Structured output stream ended/);
	});

	it("returns structured output when complete event is received", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "some text",
					content: "some text",
				};
				yield {
					type: "CUSTOM",
					name: "structured-output.complete",
					value: { object: { name: "DirectResult" } },
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "DirectResult" });
	});
});
