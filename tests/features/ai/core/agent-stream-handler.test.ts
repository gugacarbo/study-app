import type { StreamChunk } from "@tanstack/ai";
import { describe, expect, it, vi } from "vitest";
import {
	createAgentStreamState,
	createIncrementalToolEventMiddleware,
	createToolResultEmitter,
	processAgentStreamChunk,
} from "@/features/ai/core/agent-stream-handler";

describe("processAgentStreamChunk", () => {
	it("forwards reasoning deltas without mutating rawText", () => {
		const state = createAgentStreamState();
		const onReasoningDelta = vi.fn();

		processAgentStreamChunk(
			{
				type: "REASONING_MESSAGE_CONTENT",
				messageId: "reasoning-1",
				delta: "Conferindo alternativas...",
			} as StreamChunk,
			{ onReasoningDelta },
			state,
		);

		expect(onReasoningDelta).toHaveBeenCalledWith("Conferindo alternativas...");
		expect(state.rawText).toBe("");
	});

	it("streams tool-call states before completion", () => {
		const state = createAgentStreamState();
		const onToolCall = vi.fn();
		const onToolResult = vi.fn();

		processAgentStreamChunk(
			{
				type: "TOOL_CALL_START",
				toolCallId: "tc-1",
				toolCallName: "add_extracted_question",
			} as StreamChunk,
			{ onToolCall, onToolResult },
			state,
		);
		processAgentStreamChunk(
			{
				type: "TOOL_CALL_ARGS",
				toolCallId: "tc-1",
				delta: '{"question":"Q1"}',
			} as StreamChunk,
			{ onToolCall, onToolResult },
			state,
		);
		processAgentStreamChunk(
			{
				type: "TOOL_CALL_END",
				toolCallId: "tc-1",
				toolCallName: "add_extracted_question",
				input: { question: "Q1" },
				result: JSON.stringify({ ok: true, questionId: "q1" }),
			} as unknown as StreamChunk,
			{ onToolCall, onToolResult },
			state,
		);

		expect(onToolCall).toHaveBeenNthCalledWith(1, {
			toolCallId: "tc-1",
			name: "add_extracted_question",
			state: "awaiting-input",
		});
		expect(onToolCall).toHaveBeenNthCalledWith(2, {
			toolCallId: "tc-1",
			name: "add_extracted_question",
			arguments: '{"question":"Q1"}',
			input: { question: "Q1" },
			state: "input-streaming",
		});
		expect(onToolCall).toHaveBeenNthCalledWith(3, {
			toolCallId: "tc-1",
			name: "add_extracted_question",
			arguments: '{"question":"Q1"}',
			input: { question: "Q1" },
			state: "input-complete",
		});
		expect(onToolResult).toHaveBeenCalledWith({
			toolCallId: "tc-1",
			content: JSON.stringify({ ok: true, questionId: "q1" }),
			error: undefined,
			state: "complete",
		});
	});

	it("skips duplicate tool-result emissions when middleware already reported the result", () => {
		const state = createAgentStreamState();
		state.emittedToolResultIds.add("tc-1");
		const onToolResult = vi.fn();

		processAgentStreamChunk(
			{
				type: "TOOL_CALL_END",
				toolCallId: "tc-1",
				toolCallName: "add_extracted_question",
				input: { question: "Q1" },
				result: JSON.stringify({ ok: true, questionId: "q1" }),
			} as unknown as StreamChunk,
			{ onToolResult },
			state,
		);

		expect(onToolResult).not.toHaveBeenCalled();
	});
});

describe("createIncrementalToolEventMiddleware", () => {
	it("emits input-complete before execution and result right after each tool finishes", async () => {
		const onToolCall = vi.fn();
		const onToolResult = vi.fn();
		const middleware = createIncrementalToolEventMiddleware({
			onToolCall,
			onToolResult,
		});

		await middleware.onBeforeToolCall?.({} as never, {
			toolCall: {
				id: "tc-1",
				type: "function",
				function: { name: "add_extracted_question", arguments: "{}" },
			},
			tool: undefined,
			args: { questionId: "q1" },
			toolName: "add_extracted_question",
			toolCallId: "tc-1",
		});

		await middleware.onAfterToolCall?.({} as never, {
			toolCall: {
				id: "tc-1",
				type: "function",
				function: { name: "add_extracted_question", arguments: "{}" },
			},
			tool: undefined,
			toolName: "add_extracted_question",
			toolCallId: "tc-1",
			ok: true,
			duration: 12,
			result: { ok: true, questionId: "q1" },
		});

		expect(onToolCall).toHaveBeenCalledWith({
			toolCallId: "tc-1",
			name: "add_extracted_question",
			arguments: '{"questionId":"q1"}',
			input: { questionId: "q1" },
			state: "input-complete",
		});
		expect(onToolResult).toHaveBeenCalledWith({
			toolCallId: "tc-1",
			content: { ok: true, questionId: "q1" },
			state: "complete",
		});
	});

	it("ignores empty tool results so onToolExecuted can emit the real payload later", () => {
		const state = createAgentStreamState();
		const emitted: unknown[] = [];
		const emitToolResult = createToolResultEmitter((payload) => {
			emitted.push(payload);
		}, state);

		emitToolResult({ toolCallId: "tc-1", content: undefined, state: "complete" });
		emitToolResult({
			toolCallId: "tc-1",
			content: { ok: true, questionId: "q9" },
			state: "complete",
		});

		expect(emitted).toEqual([
			{
				toolCallId: "tc-1",
				content: { ok: true, questionId: "q9" },
				state: "complete",
			},
		]);
	});

	it("upgrades a partial list result when a richer payload arrives later", () => {
		const state = createAgentStreamState();
		const emitted: unknown[] = [];
		const emitToolResult = createToolResultEmitter((payload) => {
			emitted.push(payload);
		}, state);

		emitToolResult({
			toolCallId: "tc-list",
			content: {
				ok: true,
				totalQuestions: 1,
				data: [{ questionId: "q1", question: "Q1" }],
			},
			state: "complete",
		});
		emitToolResult({
			toolCallId: "tc-list",
			content: {
				ok: true,
				totalQuestions: 3,
				data: [
					{ questionId: "q1", question: "Q1" },
					{ questionId: "q2", question: "Q2" },
					{ questionId: "q3", question: "Q3" },
				],
			},
			state: "complete",
		});

		expect(emitted).toHaveLength(2);
		expect(emitted[1]).toEqual({
			toolCallId: "tc-list",
			content: {
				ok: true,
				totalQuestions: 3,
				data: [
					{ questionId: "q1", question: "Q1" },
					{ questionId: "q2", question: "Q2" },
					{ questionId: "q3", question: "Q3" },
				],
			},
			state: "complete",
		});
	});

	it("forwards middleware tool results through createToolResultEmitter without dropping payload", () => {
		const state = createAgentStreamState();
		const emitted: unknown[] = [];
		const emitToolResult = createToolResultEmitter((payload) => {
			emitted.push(payload);
		}, state);
		const middleware = createIncrementalToolEventMiddleware({
			onToolResult: emitToolResult,
		});

		void middleware.onAfterToolCall?.({} as never, {
			toolCall: {
				id: "tc-1",
				type: "function",
				function: { name: "add_extracted_question", arguments: "{}" },
			},
			tool: undefined,
			toolName: "add_extracted_question",
			toolCallId: "tc-1",
			ok: true,
			duration: 8,
			result: { ok: true, questionId: "q9" },
		});

		expect(emitted).toEqual([
			{
				toolCallId: "tc-1",
				content: { ok: true, questionId: "q9" },
				error: undefined,
				state: "complete",
			},
		]);
	});
});
