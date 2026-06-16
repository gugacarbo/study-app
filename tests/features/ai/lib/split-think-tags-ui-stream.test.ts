import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import { splitThinkTagsInUIMessageStream } from "@/features/ai/lib/split-think-tags-ui-stream";

const THINK_OPEN = ["<", "think", ">"].join("");
const THINK_CLOSE = ["<", "/", "think", ">"].join("");

async function collectChunks(
	chunks: UIMessageChunk[],
): Promise<UIMessageChunk[]> {
	const stream = splitThinkTagsInUIMessageStream(
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(chunk);
				}
				controller.close();
			},
		}),
	);
	const reader = stream.getReader();
	const output: UIMessageChunk[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		output.push(value);
	}
	return output;
}

describe("splitThinkTagsInUIMessageStream", () => {
	it("converts embedded think tags into reasoning chunks", async () => {
		const output = await collectChunks([
			{ type: "text-start", id: "text-1" },
			{
				type: "text-delta",
				id: "text-1",
				delta: `${THINK_OPEN}internal thought${THINK_CLOSE}Olá!`,
			},
			{ type: "text-end", id: "text-1" },
		]);

		expect(output).toEqual([
			{ type: "reasoning-start", id: "text-1-reasoning-1" },
			{
				type: "reasoning-delta",
				id: "text-1-reasoning-1",
				delta: "internal thought",
			},
			{ type: "reasoning-end", id: "text-1-reasoning-1" },
			{ type: "text-start", id: "text-1-text-1" },
			{ type: "text-delta", id: "text-1-text-1", delta: "Olá!" },
			{ type: "text-end", id: "text-1-text-1" },
		]);
	});

	it("passes through chunks without think tags", async () => {
		const input: UIMessageChunk[] = [
			{ type: "text-start", id: "text-1" },
			{ type: "text-delta", id: "text-1", delta: "Hello" },
			{ type: "text-end", id: "text-1" },
			{ type: "tool-input-start", toolCallId: "tool-1", toolName: "search" },
		];

		const output = await collectChunks(input);
		expect(output).toEqual([
			{ type: "text-start", id: "text-1" },
			{ type: "text-delta", id: "text-1", delta: "Hello" },
			{ type: "text-end", id: "text-1" },
			{ type: "tool-input-start", toolCallId: "tool-1", toolName: "search" },
		]);
	});
});
