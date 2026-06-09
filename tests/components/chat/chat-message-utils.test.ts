import type { UIMessage } from "@tanstack/ai-client";
import { describe, expect, it } from "vitest";
import {
	buildRenderableAssistantBlocks,
	expandAssistantMessageParts,
	formatToolPayload,
	groupAgentWorkSections,
	groupAssistantMessageParts,
	resolveThinkingIsPending,
	shouldShowAssistantThinkingPlaceholder,
} from "@/features/ai/components/chat/message/chat-message-utils";

describe("formatToolPayload", () => {
	it("pretty-prints JSON strings", () => {
		expect(
			formatToolPayload('{"ok":true,"questionId":"q1"}'),
		).toBe('{\n  "ok": true,\n  "questionId": "q1"\n}');
	});

	it("pretty-prints objects", () => {
		expect(formatToolPayload({ question: "Q1", answer: "2x" })).toBe(
			'{\n  "question": "Q1",\n  "answer": "2x"\n}',
		);
	});

	it("returns partial JSON strings while streaming", () => {
		expect(formatToolPayload('{"question":"Q1"')).toBe('{"question":"Q1"');
	});
});

describe("groupAssistantMessageParts", () => {
	it("nests a matching tool-result inside its tool-call", () => {
		const grouped = groupAssistantMessageParts([
			{ type: "text", content: "Reviewing q1." },
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
		]);

		expect(grouped).toHaveLength(2);
		expect(grouped[1]).toEqual({
			kind: "tool-call",
			toolCall: expect.objectContaining({ id: "tc-1" }),
			toolResult: expect.objectContaining({ toolCallId: "tc-1" }),
			index: 1,
		});
	});

	it("pairs tool results by toolCallId even after multiple consecutive tool calls", () => {
		const grouped = groupAssistantMessageParts([
			{
				type: "tool-call",
				id: "tc-1",
				name: "add_extracted_question",
				arguments: '{"questionId":"q1"}',
				state: "input-complete",
			},
			{
				type: "tool-call",
				id: "tc-2",
				name: "add_extracted_question",
				arguments: '{"questionId":"q2"}',
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{"ok":true,"questionId":"q1"}',
				state: "complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-2",
				content: '{"ok":true,"questionId":"q2"}',
				state: "complete",
			},
		]);

		expect(grouped).toHaveLength(2);
		expect(grouped[0]).toEqual({
			kind: "tool-call",
			toolCall: expect.objectContaining({ id: "tc-1" }),
			toolResult: expect.objectContaining({ toolCallId: "tc-1" }),
			index: 0,
		});
		expect(grouped[1]).toEqual({
			kind: "tool-call",
			toolCall: expect.objectContaining({ id: "tc-2" }),
			toolResult: expect.objectContaining({ toolCallId: "tc-2" }),
			index: 1,
		});
	});

	it("keeps orphan tool results as standalone parts", () => {
		const grouped = groupAssistantMessageParts([
			{
				type: "tool-result",
				toolCallId: "missing",
				content: '{"ok":true}',
				state: "complete",
			},
		]);

		expect(grouped).toEqual([
			{
				kind: "single",
				part: expect.objectContaining({ type: "tool-result" }),
				index: 0,
			},
		]);
	});
});

describe("resolveThinkingIsPending", () => {
	it("returns true while reasoning is the trailing part of a pending message", () => {
		expect(
			resolveThinkingIsPending(
				0,
				[{ type: "thinking", content: "Checking layout." }],
				true,
			),
		).toBe(true);
	});

	it("returns false once later assistant parts arrive", () => {
		expect(
			resolveThinkingIsPending(
				0,
				[
					{ type: "thinking", content: "Checking layout." },
					{
						type: "tool-call",
						id: "call-1",
						name: "lookup",
						arguments: "{}",
						state: "input-complete",
					},
				],
				true,
			),
		).toBe(false);
	});

	it("returns false when the message is no longer pending", () => {
		expect(
			resolveThinkingIsPending(
				0,
				[{ type: "thinking", content: "Checking layout." }],
				false,
			),
		).toBe(false);
	});
});

describe("shouldShowAssistantThinkingPlaceholder", () => {
	it("returns true while pending with no visible assistant content", () => {
		expect(
			shouldShowAssistantThinkingPlaceholder(
				[{ type: "text", content: "" }],
				true,
			),
		).toBe(true);
	});

	it("returns false once thinking or text content arrives", () => {
		expect(
			shouldShowAssistantThinkingPlaceholder(
				[{ type: "thinking", content: "Checking sources." }],
				true,
			),
		).toBe(false);
	});

	it("returns false when not pending", () => {
		expect(
			shouldShowAssistantThinkingPlaceholder(
				[{ type: "text", content: "" }],
				false,
			),
		).toBe(false);
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
});

describe("buildRenderableAssistantBlocks", () => {
	it("groups completed multi-action runs once the message is no longer pending", () => {
		const parts = [
			{
				type: "text",
				content: "<think>Planning extraction.</think>",
			},
			{
				type: "tool-call",
				id: "tc-1",
				name: "add_extracted_question",
				arguments: "{}",
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{"ok":true}',
				state: "complete",
			},
			{
				type: "text",
				content:
					"<think>Verifying result.</think>Extraction complete.",
			},
		] as UIMessage["parts"];

		expect(buildRenderableAssistantBlocks(parts, { isPending: true })).toEqual([
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({ type: "thinking" }),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					kind: "tool-call",
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({ type: "thinking" }),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({
						type: "text",
						content: "Extraction complete.",
					}),
				}),
			},
		]);

		const blocks = buildRenderableAssistantBlocks(parts, { isPending: false });
		expect(blocks).toHaveLength(2);
		expect(blocks[0]?.kind).toBe("agent-work");
		if (blocks[0]?.kind === "agent-work") {
			expect(blocks[0].parts).toHaveLength(3);
		}
		expect(blocks[1]).toEqual({
			kind: "content",
			groupedPart: expect.objectContaining({
				part: expect.objectContaining({
					type: "text",
					content: "Extraction complete.",
				}),
			}),
		});
	});

	it("keeps a single completed tool call ungrouped even after the message finishes", () => {
		const blocks = buildRenderableAssistantBlocks(
			[
				{ type: "text", content: "Let me inspect the question." },
				{
					type: "tool-call",
					id: "tc-1",
					name: "list_extracted_questions",
					arguments: "{}",
					state: "input-complete",
				},
				{
					type: "tool-result",
					toolCallId: "tc-1",
					content: '{"ok":true}',
					state: "complete",
				},
			],
			{ isPending: false },
		);

		expect(blocks).toEqual([
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({
						type: "text",
						content: "Let me inspect the question.",
					}),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-1" }),
				}),
			},
		]);
	});

	it("groups many completed tool calls once the trailing run finishes", () => {
		const blocks = buildRenderableAssistantBlocks(
			[
				{ type: "text", content: "Let me add them one by one." },
				{
					type: "tool-call",
					id: "tc-1",
					name: "add_extracted_question",
					arguments: '{"questionId":"q1"}',
					state: "input-complete",
				},
				{
					type: "tool-call",
					id: "tc-2",
					name: "add_extracted_question",
					arguments: '{"questionId":"q2"}',
					state: "input-complete",
				},
				{
					type: "tool-result",
					toolCallId: "tc-1",
					content: '{"ok":true}',
					state: "complete",
				},
				{
					type: "tool-result",
					toolCallId: "tc-2",
					content: '{"ok":true}',
					state: "complete",
				},
			],
			{ isPending: false },
		);

		expect(blocks).toEqual([
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({
						type: "text",
						content: "Let me add them one by one.",
					}),
				}),
			},
			{
				kind: "agent-work",
				parts: [
					expect.objectContaining({
						kind: "tool-call",
						toolCall: expect.objectContaining({ id: "tc-1" }),
						toolResult: expect.objectContaining({ toolCallId: "tc-1" }),
					}),
					expect.objectContaining({
						kind: "tool-call",
						toolCall: expect.objectContaining({ id: "tc-2" }),
						toolResult: expect.objectContaining({ toolCallId: "tc-2" }),
					}),
				],
			},
		]);
	});

	it("keeps an in-progress trailing run ungrouped while pending", () => {
		const blocks = buildRenderableAssistantBlocks(
			[
				{
					type: "tool-call",
					id: "tc-1",
					name: "add_extracted_question",
					arguments: '{"questionId":"q1"}',
					state: "input-complete",
				},
				{
					type: "tool-call",
					id: "tc-2",
					name: "add_extracted_question",
					arguments: '{"questionId":"q2"}',
					state: "input-streaming",
				},
				{
					type: "tool-result",
					toolCallId: "tc-1",
					content: '{"ok":true}',
					state: "complete",
				},
			],
			{ isPending: true },
		);

		expect(blocks).toEqual([
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-1" }),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-2" }),
				}),
			},
		]);
	});
});

describe("groupAgentWorkSections", () => {
	it("groups completed multi-action runs after the trailing run finishes", () => {
		const grouped = groupAssistantMessageParts([
			{ type: "thinking", content: "Checking the PDF layout." },
			{
				type: "tool-call",
				id: "tc-1",
				name: "add_extracted_question",
				arguments: "{}",
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{"ok":true}',
				state: "complete",
			},
			{ type: "thinking", content: "Summarizing the extraction." },
			{
				type: "text",
				content: "Extraction complete. I found and registered 1 question.",
			},
		]);

		expect(groupAgentWorkSections(grouped, { isPending: false })).toEqual([
			{
				kind: "agent-work",
				parts: [grouped[0], grouped[1], grouped[2]],
			},
			{
				kind: "content",
				groupedPart: grouped[3],
			},
		]);
	});

	it("keeps a single tool call as an individual content block", () => {
		const grouped = groupAssistantMessageParts([
			{ type: "text", content: "Inspecting the current question." },
			{
				type: "tool-call",
				id: "tc-1",
				name: "list_extracted_questions",
				arguments: "{}",
				state: "input-complete",
			},
		]);

		expect(groupAgentWorkSections(grouped, { isPending: false })).toEqual([
			{
				kind: "content",
				groupedPart: grouped[0],
			},
			{
				kind: "content",
				groupedPart: grouped[1],
			},
		]);
	});

	it("groups interstitial text between tool calls into one agent-work block when complete", () => {
		const grouped = groupAssistantMessageParts([
			{ type: "thinking", content: "Planning lookup." },
			{
				type: "tool-call",
				id: "tc-1",
				name: "list_attempts",
				arguments: "{}",
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{"count":3}',
				state: "complete",
			},
			{ type: "text", content: "Found 3 attempts, checking details." },
			{ type: "thinking", content: "Fetching details." },
			{
				type: "tool-call",
				id: "tc-2",
				name: "list_attempts",
				arguments: '{"detail":true}',
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-2",
				content: '{"ok":true}',
				state: "complete",
			},
		]);

		const blocks = groupAgentWorkSections(grouped, { isPending: false });
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.kind).toBe("agent-work");
		if (blocks[0]?.kind === "agent-work") {
			expect(blocks[0].parts).toHaveLength(4);
			expect(blocks[0].parts).toEqual([
				expect.objectContaining({
					part: expect.objectContaining({ type: "thinking" }),
				}),
				expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-1" }),
				}),
				expect.objectContaining({
					part: expect.objectContaining({ type: "thinking" }),
				}),
				expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-2" }),
				}),
			]);
		}
	});

	it("keeps interstitial work as individual content blocks while pending", () => {
		const grouped = groupAssistantMessageParts([
			{ type: "thinking", content: "Planning lookup." },
			{
				type: "tool-call",
				id: "tc-1",
				name: "list_attempts",
				arguments: "{}",
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{"count":3}',
				state: "complete",
			},
			{ type: "text", content: "Found 3 attempts, checking details." },
			{ type: "thinking", content: "Fetching details." },
			{
				type: "tool-call",
				id: "tc-2",
				name: "list_attempts",
				arguments: '{"detail":true}',
				state: "input-streaming",
			},
		]);

		const blocks = groupAgentWorkSections(grouped, { isPending: true });
		expect(blocks).toEqual([
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({ type: "thinking" }),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-1" }),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					part: expect.objectContaining({ type: "thinking" }),
				}),
			},
			{
				kind: "content",
				groupedPart: expect.objectContaining({
					kind: "tool-call",
					toolCall: expect.objectContaining({ id: "tc-2" }),
				}),
			},
		]);
	});

	it("splits intro text, work region, and final answer into three blocks", () => {
		const grouped = groupAssistantMessageParts([
			{ type: "text", content: "Let me check your exam attempts." },
			{ type: "thinking", content: "Querying attempts." },
			{
				type: "tool-call",
				id: "tc-1",
				name: "list_attempts",
				arguments: "{}",
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{"count":5}',
				state: "complete",
			},
			{ type: "text", content: "You have 5 exam attempts on record." },
		]);

		const blocks = groupAgentWorkSections(grouped, { isPending: false });
		expect(blocks).toHaveLength(3);
		expect(blocks[0]).toEqual({
			kind: "content",
			groupedPart: expect.objectContaining({
				part: expect.objectContaining({
					type: "text",
					content: "Let me check your exam attempts.",
				}),
			}),
		});
		expect(blocks[1]?.kind).toBe("agent-work");
		if (blocks[1]?.kind === "agent-work") {
			expect(blocks[1].parts).toHaveLength(2);
		}
		expect(blocks[2]).toEqual({
			kind: "content",
			groupedPart: expect.objectContaining({
				part: expect.objectContaining({
					type: "text",
					content: "You have 5 exam attempts on record.",
				}),
			}),
		});
	});
});

describe("resolveToolCallTriggerPresentation", () => {
	it("marks only completed tool calls as success while others stay loading", async () => {
		const { resolveToolCallTriggerPresentation } = await import(
			"@/features/ai/components/chat/message/chat-message-utils"
		);

		const completed = resolveToolCallTriggerPresentation(
			{
				name: "add_extracted_question",
				arguments: "{}",
				state: "input-complete",
			},
			{
				state: "complete",
				content: '{"ok":true}',
			},
		);
		const pending = resolveToolCallTriggerPresentation(
			{
				name: "add_extracted_question",
				arguments: "{}",
				state: "input-complete",
			},
		);

		expect(completed).toEqual({ tone: "success", isLoading: false });
		expect(pending).toEqual({ tone: "progress", isLoading: true });
	});
});
