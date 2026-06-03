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
