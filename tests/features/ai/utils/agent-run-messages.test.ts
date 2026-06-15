import { describe, expect, it } from "vitest";
import type { ImproveQuestionsAgentEvent } from "@/features/ai/agents/improve-questions/contracts";
import {
	agentRunDataPartToReducerEvent,
	createAgentRunState,
	reduceAgentEvent,
} from "@/features/ai/utils/agent-run-messages";

function agentEvent(
	overrides?: Partial<ImproveQuestionsAgentEvent>,
): ImproveQuestionsAgentEvent {
	return {
		eventType: "lifecycle",
		stageId: "improve-questions",
		agentRunId: "run-1",
		label: "Improve question",
		timestamp: 1,
		status: "running",
		...overrides,
	};
}

describe("agent-run-messages", () => {
	it("creates system, user, and assistant messages from initial prompts", () => {
		const state = createAgentRunState({
			agentRunId: "run-1",
			label: "Improve question",
			systemPrompt: "system",
			userPrompt: "user",
		});

		expect(state.messages).toEqual([
			{
				id: "run-1:system",
				role: "system",
				parts: [{ type: "text", text: "system" }],
			},
			{
				id: "run-1:user",
				role: "user",
				parts: [{ type: "text", text: "user" }],
			},
			{
				id: "run-1:assistant",
				role: "assistant",
				parts: [{ type: "text", text: "" }],
			},
		]);
	});

	it("converts streamed token events into text-chunk reducer events", () => {
		expect(
			agentRunDataPartToReducerEvent({
				eventType: "token",
				stageId: "improve-questions",
				agentRunId: "run-1",
				label: "Improve question",
				timestamp: 1,
				rawText: "Hello",
			}),
		).toEqual({
			eventType: "text-chunk",
			agentRunId: "run-1",
			text: "Hello",
			kind: "text",
			timestamp: 1,
		});

		expect(
			agentRunDataPartToReducerEvent({
				eventType: "token",
				stageId: "improve-questions",
				agentRunId: "run-1",
				label: "Improve question",
				timestamp: 2,
				rawText: "Thinking",
				meta: { kind: "reasoning" },
			}),
		).toEqual({
			eventType: "text-chunk",
			agentRunId: "run-1",
			text: "Thinking",
			kind: "reasoning",
			timestamp: 2,
		});
	});

	it("appends text and reasoning chunks into assistant parts", () => {
		let state = createAgentRunState({
			agentRunId: "run-1",
			label: "Improve question",
		});

		state = reduceAgentEvent(state, {
			eventType: "text-chunk",
			agentRunId: "run-1",
			text: "Hello ",
			kind: "text",
		});
		state = reduceAgentEvent(state, {
			eventType: "text-chunk",
			agentRunId: "run-1",
			text: "world",
			kind: "text",
		});
		state = reduceAgentEvent(state, {
			eventType: "text-chunk",
			agentRunId: "run-1",
			text: "Thinking...",
			kind: "reasoning",
		});

		const assistant = state.messages.find(
			(message) => message.role === "assistant",
		);

		expect(state.outputText).toBe("Hello world");
		expect(assistant?.parts).toEqual([
			{ type: "text", text: "Hello world" },
			{ type: "reasoning", text: "Thinking..." },
		]);
	});

	it("records tool-call and tool-result parts on agent events", () => {
		let state = createAgentRunState({
			agentRunId: "run-1",
			label: "Improve question",
		});

		state = reduceAgentEvent(
			state,
			agentEvent({
				eventType: "tool-call",
				name: "get_question",
				arguments: "{}",
				state: "input-complete",
				meta: { toolCallId: "call-1" },
			}),
		);
		state = reduceAgentEvent(
			state,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true },
				state: "complete",
				meta: { toolCallId: "call-1" },
			}),
		);

		const assistant = state.messages.find(
			(message) => message.role === "assistant",
		);

		expect(assistant?.parts).toEqual([
			{
				type: "dynamic-tool",
				toolCallId: "call-1",
				toolName: "get_question",
				state: "output-available",
				input: {},
				output: { ok: true },
				errorText: undefined,
			},
		]);
	});

	it("preserves tool name on tool-result events", () => {
		let state = createAgentRunState({
			agentRunId: "run-1",
			label: "Improve question",
		});

		state = reduceAgentEvent(
			state,
			agentEvent({
				eventType: "tool-call",
				name: "get_question",
				arguments: '{"id":715}',
				input: { id: 715 },
				state: "input-complete",
				meta: { toolCallId: "call-1" },
			}),
		);
		state = reduceAgentEvent(
			state,
			agentEvent({
				eventType: "tool-result",
				name: "get_question",
				content: { ok: true, data: { id: 715 } },
				state: "complete",
				meta: { toolCallId: "call-1" },
			}),
		);

		const assistant = state.messages.find(
			(message) => message.role === "assistant",
		);

		expect(assistant?.parts[0]).toMatchObject({
			type: "dynamic-tool",
			toolCallId: "call-1",
			toolName: "get_question",
			output: { ok: true, data: { id: 715 } },
		});
	});

	it("syncs lifecycle prompts into messages", () => {
		const state = reduceAgentEvent(
			createAgentRunState({
				agentRunId: "run-1",
				label: "Improve question",
			}),
			agentEvent({
				systemPrompt: "system prompt",
				userPrompt: "user prompt",
				status: "running",
			}),
		);

		expect(state.systemPrompt).toBe("system prompt");
		expect(state.userPrompt).toBe("user prompt");
		expect(state.messages).toEqual([
			{
				id: "run-1:system",
				role: "system",
				parts: [{ type: "text", text: "system prompt" }],
			},
			{
				id: "run-1:user",
				role: "user",
				parts: [{ type: "text", text: "user prompt" }],
			},
			{
				id: "run-1:assistant",
				role: "assistant",
				parts: [{ type: "text", text: "" }],
			},
		]);
	});
});
