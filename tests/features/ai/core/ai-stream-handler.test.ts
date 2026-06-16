import type { TextStreamPart, ToolSet } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
	createAiStreamState,
	createIncrementalToolChunkHandler,
	createToolResultEmitter,
	isRecoverableStreamPartError,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";

describe("processAiStreamPart", () => {
	it("splits embedded think tags into reasoning and text deltas", () => {
		const state = createAiStreamState();
		const onTextDelta = vi.fn();
		const onReasoningDelta = vi.fn();
		const thinkOpen = ["<", "think", ">"].join("");
		const thinkClose = ["<", "/", "think", ">"].join("");

		processAiStreamPart(
			{
				type: "text-delta",
				text: `${thinkOpen}internal thought${thinkClose}Visible answer`,
			} as TextStreamPart<ToolSet>,
			{ onTextDelta, onReasoningDelta },
			state,
		);

		expect(onReasoningDelta).toHaveBeenCalledWith("internal thought");
		expect(onTextDelta).toHaveBeenCalledWith("Visible answer");
		expect(state.rawText).toBe("Visible answer");
	});

	it("forwards reasoning deltas without mutating rawText", () => {
		const state = createAiStreamState();
		const onReasoningDelta = vi.fn();

		processAiStreamPart(
			{
				type: "reasoning-delta",
				text: "Conferindo alternativas...",
			} as TextStreamPart<ToolSet>,
			{ onReasoningDelta },
			state,
		);

		expect(onReasoningDelta).toHaveBeenCalledWith("Conferindo alternativas...");
		expect(state.rawText).toBe("");
	});

	it("streams tool-call states before completion", () => {
		const state = createAiStreamState();
		const onToolCall = vi.fn();
		const onToolResult = vi.fn();

		processAiStreamPart(
			{
				type: "tool-input-start",
				id: "tc-1",
				toolName: "add_extracted_question",
			} as TextStreamPart<ToolSet>,
			{ onToolCall, onToolResult },
			state,
		);
		processAiStreamPart(
			{
				type: "tool-input-delta",
				id: "tc-1",
				delta: '{"question":"Q1"}',
			} as TextStreamPart<ToolSet>,
			{ onToolCall, onToolResult },
			state,
		);
		processAiStreamPart(
			{
				type: "tool-call",
				toolCallId: "tc-1",
				toolName: "add_extracted_question",
				input: { question: "Q1" },
			} as TextStreamPart<ToolSet>,
			{ onToolCall, onToolResult },
			state,
		);
		processAiStreamPart(
			{
				type: "tool-result",
				toolCallId: "tc-1",
				toolName: "add_extracted_question",
				input: { question: "Q1" },
				output: { ok: true, questionId: "q1" },
			} as TextStreamPart<ToolSet>,
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
		expect(onToolCall).toHaveBeenNthCalledWith(4, {
			toolCallId: "tc-1",
			name: "add_extracted_question",
			arguments: '{"question":"Q1"}',
			input: { question: "Q1" },
			state: "input-complete",
		});
		expect(onToolResult).toHaveBeenCalledWith({
			toolCallId: "tc-1",
			content: { ok: true, questionId: "q1" },
			error: undefined,
			state: "complete",
		});
	});

	it("skips duplicate tool-result emissions when middleware already reported the result", () => {
		const state = createAiStreamState();
		state.emittedToolResultIds.add("tc-1");
		const onToolResult = vi.fn();

		processAiStreamPart(
			{
				type: "tool-result",
				toolCallId: "tc-1",
				toolName: "add_extracted_question",
				input: { question: "Q1" },
				output: { ok: true, questionId: "q1" },
			} as TextStreamPart<ToolSet>,
			{ onToolResult },
			state,
		);

		expect(onToolResult).not.toHaveBeenCalled();
	});
});

describe("createIncrementalToolChunkHandler", () => {
	it("emits input-complete and result when tool-call and tool-result arrive", () => {
		const onToolCall = vi.fn();
		const onToolResult = vi.fn();
		const state = createAiStreamState();
		const handler = createIncrementalToolChunkHandler(
			{ onToolCall, onToolResult },
			state,
		);

		handler({
			type: "tool-call",
			toolCallId: "tc-1",
			toolName: "add_extracted_question",
			input: { questionId: "q1" },
		} as TextStreamPart<ToolSet>);
		handler({
			type: "tool-result",
			toolCallId: "tc-1",
			toolName: "add_extracted_question",
			input: { questionId: "q1" },
			output: { ok: true, questionId: "q1" },
		} as TextStreamPart<ToolSet>);

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
		const state = createAiStreamState();
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
		const state = createAiStreamState();
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

	it("forwards tool results through createToolResultEmitter without dropping payload", () => {
		const state = createAiStreamState();
		const emitted: unknown[] = [];
		const emitToolResult = createToolResultEmitter((payload) => {
			emitted.push(payload);
		}, state);

		processAiStreamPart(
			{
				type: "tool-result",
				toolCallId: "tc-1",
				toolName: "add_extracted_question",
				input: {},
				output: { ok: true, questionId: "q9" },
			} as TextStreamPart<ToolSet>,
			{},
			state,
			emitToolResult,
		);

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

describe("isRecoverableStreamPartError", () => {
	function asErrorPart(error: unknown): TextStreamPart<ToolSet> {
		return { type: "error", error } as unknown as TextStreamPart<ToolSet>;
	}

	it("returns true for AI SDK missing text-part compatibility errors", () => {
		expect(
			isRecoverableStreamPartError(
				asErrorPart(
					"text part dde5bf33-a114-4841-b717-7d9f17785d67 not found",
				),
			),
		).toBe(true);
		expect(
			isRecoverableStreamPartError(
				asErrorPart(
					new Error(
						"AI provider returned error: text part abc-123 not found",
					),
				),
			),
		).toBe(true);
	});

	it("returns false for other stream errors", () => {
		expect(
			isRecoverableStreamPartError(asErrorPart("provider rate limit")),
		).toBe(false);
		expect(
			isRecoverableStreamPartError(asErrorPart(new Error("something else"))),
		).toBe(false);
		expect(isRecoverableStreamPartError("not a chunk" as unknown as TextStreamPart<ToolSet>)).toBe(false);
	});
});
