import type { UIMessage } from "@tanstack/ai-client";
import { describe, expect, it } from "vitest";
import {
	convertUIMessageToThreadMessageLike,
	expandAssistantMessageParts,
	mergeAssistantTurnMessages,
	safeJson,
	toThreadMessages,
} from "@/features/ai/adapters/tanstack-message-adapter";

describe("mergeAssistantTurnMessages", () => {
	it("merges consecutive assistant messages into one turn", () => {
		const messages: UIMessage[] = [
			{ id: "u1", role: "user", parts: [{ type: "text", content: "Hi" }] },
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "tool-call",
						id: "tc-1",
						name: "lookup",
						arguments: "{}",
						state: "input-complete",
					},
				],
			},
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", content: "Done." }],
			},
		];

		expect(mergeAssistantTurnMessages(messages)).toEqual([
			messages[0],
			{
				id: "a2",
				role: "assistant",
				parts: [...messages[1]!.parts, ...messages[2]!.parts],
			},
		]);
	});

	it("does not merge welcome assistant message", () => {
		const messages: UIMessage[] = [
			{ id: "welcome", role: "assistant", parts: [{ type: "text", content: "Hi" }] },
			{ id: "a1", role: "assistant", parts: [{ type: "text", content: "More" }] },
		];

		expect(mergeAssistantTurnMessages(messages)).toHaveLength(2);
	});
});

describe("expandAssistantMessageParts", () => {
	it("splits embedded thinking tags out of text parts", () => {
		expect(
			expandAssistantMessageParts([
				{
					type: "text",
					content:
						"<think>Checking layout.</think>Done.",
				},
			]),
		).toEqual([
			{ type: "thinking", content: "Checking layout." },
			{ type: "text", content: "Done." },
		]);
	});

	it("keeps thinking-only post-tool text as a visible assistant response", () => {
		expect(
			expandAssistantMessageParts([
				{
					type: "tool-call",
					id: "tc-1",
					name: "list_attempts",
					arguments: "{}",
					state: "input-complete",
				},
				{
					type: "text",
					content:
						"<think>Você fez 12 tentativas em 3 exames.</think>",
				},
			]),
		).toEqual([
			expect.objectContaining({ type: "tool-call", id: "tc-1" }),
			{ type: "thinking", content: "Você fez 12 tentativas em 3 exames." },
			{
				type: "text",
				content: "Você fez 12 tentativas em 3 exames.",
			},
		]);
	});
});

describe("convertUIMessageToThreadMessageLike", () => {
	it("maps text and thinking parts to assistant-ui content", () => {
		const converted = convertUIMessageToThreadMessageLike({
			id: "a1",
			role: "assistant",
			parts: [
				{ type: "thinking", content: "Planning." },
				{ type: "text", content: "Hello." },
			],
		});

		expect(converted).toEqual({
			id: "a1",
			role: "assistant",
			content: [
				{ type: "reasoning", text: "Planning." },
				{ type: "text", text: "Hello." },
			],
			status: { type: "complete", reason: "stop" },
		});
	});

	it("pairs tool results with tool calls", () => {
		const converted = convertUIMessageToThreadMessageLike({
			id: "a1",
			role: "assistant",
			parts: [
				{
					type: "tool-call",
					id: "tc-1",
					name: "update_extracted_question",
					arguments: '{"questionId":"q1"}',
					state: "input-complete",
				},
				{
					type: "tool-result",
					toolCallId: "tc-1",
					content: '{"ok":true}',
					state: "complete",
				},
			],
		});

		expect(converted.content).toEqual([
			{
				type: "tool-call",
				toolCallId: "tc-1",
				toolName: "update_extracted_question",
				argsText: '{"questionId":"q1"}',
				result: '{"ok":true}',
				isError: false,
			},
		]);
	});

	it("marks the last assistant message as running when pending", () => {
		const converted = convertUIMessageToThreadMessageLike(
			{
				id: "a1",
				role: "assistant",
				parts: [{ type: "text", content: "..." }],
			},
			{ isPending: true },
		);

		expect(converted.status).toEqual({ type: "running" });
	});
});

describe("toThreadMessages", () => {
	it("merges assistant turns before conversion", () => {
		const converted = toThreadMessages([
			{ id: "u1", role: "user", parts: [{ type: "text", content: "Hi" }] },
			{
				id: "a1",
				role: "assistant",
				parts: [
					{
						type: "tool-call",
						id: "tc-1",
						name: "lookup",
						arguments: "{}",
						state: "input-complete",
					},
				],
			},
			{
				id: "a2",
				role: "assistant",
				parts: [{ type: "text", content: "Done." }],
			},
		]);

		expect(converted).toHaveLength(2);
		expect(converted[1]?.content).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "tool-call", toolCallId: "tc-1" }),
				{ type: "text", text: "Done." },
			]),
		);
	});
});

describe("safeJson", () => {
	it("pretty-prints objects", () => {
		expect(safeJson({ ok: true })).toBe('{\n  "ok": true\n}');
	});
});
