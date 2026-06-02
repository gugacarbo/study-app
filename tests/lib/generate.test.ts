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
});
