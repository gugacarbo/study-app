import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateTextMock, loggedStreamTextMock } = vi.hoisted(() => ({
	generateTextMock: vi.fn(),
	loggedStreamTextMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return {
		...actual,
		generateText: generateTextMock,
	};
});

vi.mock("@/features/ai/core/logged-stream-text", () => ({
	loggedStreamText: loggedStreamTextMock,
}));

import { streamTextWithCompatibilityFallback } from "@/features/ai/core/stream-text-compat";

const usage = {
	inputTokens: 10,
	outputTokens: 5,
	totalTokens: 15,
};

function createStreamResult(parts: unknown[], text = "ready") {
	return {
		fullStream: (async function* () {
			for (const part of parts) {
				yield part;
			}
		})(),
		text: Promise.resolve(text),
		usage: Promise.resolve(usage),
	};
}

describe("streamTextWithCompatibilityFallback", () => {
	beforeEach(() => {
		generateTextMock.mockReset();
		loggedStreamTextMock.mockReset();
	});

	it("returns the streamed response when the stream is valid", async () => {
		loggedStreamTextMock.mockReturnValue(
			createStreamResult([
				{ type: "text-delta", text: "I'm ready." },
				{ type: "finish-step", usage },
			]),
		);

		const parts: unknown[] = [];
		const result = await streamTextWithCompatibilityFallback({
			ctx: {
				callType: "test",
				provider: "LiteLLM",
				model: "minimax/m3",
			},
			request: {
				model: "mock-model",
				messages: [{ role: "user", content: "Say ready" }],
			} as never,
			onStreamPart: (chunk) => {
				parts.push(chunk);
			},
		});

		expect(result.usedGenerateTextFallback).toBe(false);
		expect(result.text).toBe("ready");
		expect(result.usage).toEqual(usage);
		expect(parts).toHaveLength(2);
		expect(generateTextMock).not.toHaveBeenCalled();
	});

	it("falls back to generateText on missing text-part compatibility errors", async () => {
		loggedStreamTextMock.mockReturnValue(
			createStreamResult([{ type: "error", error: "text part abc-123 not found" }]),
		);
		generateTextMock.mockResolvedValue({
			text: "I'm ready.",
			totalUsage: usage,
			finishReason: "stop",
			steps: [],
		});

		const result = await streamTextWithCompatibilityFallback({
			ctx: {
				callType: "test",
				provider: "LiteLLM",
				model: "minimax/m3",
			},
			request: {
				model: "mock-model",
				messages: [{ role: "user", content: "Say ready" }],
			} as never,
			onStreamPart: vi.fn(),
		});

		expect(result.usedGenerateTextFallback).toBe(true);
		expect(result.text).toBe("I'm ready.");
		expect(result.usage).toEqual(usage);
		expect(generateTextMock).toHaveBeenCalledTimes(1);
	});

	it("rethrows non-compatibility stream errors without falling back", async () => {
		loggedStreamTextMock.mockReturnValue(
			createStreamResult([{ type: "error", error: "provider rate limit" }]),
		);

		await expect(
			streamTextWithCompatibilityFallback({
				ctx: {
					callType: "test",
					provider: "LiteLLM",
					model: "minimax/m3",
				},
				request: {
					model: "mock-model",
					messages: [{ role: "user", content: "Say ready" }],
				} as never,
				onStreamPart: vi.fn(),
			}),
		).rejects.toThrow("AI provider returned error: provider rate limit");

		expect(generateTextMock).not.toHaveBeenCalled();
	});
});
