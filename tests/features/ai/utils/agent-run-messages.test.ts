import { describe, expect, it } from "vitest";
import type { ImproveQuestionsAgentEvent } from "@/features/ai/agents/improve-questions/contracts";
import {
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
				parts: [{ type: "text", content: "system" }],
			},
			{
				id: "run-1:user",
				role: "user",
				parts: [{ type: "text", content: "user" }],
			},
			{
				id: "run-1:assistant",
				role: "assistant",
				parts: [{ type: "text", content: "" }],
			},
		]);
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
			{ type: "text", content: "Hello world" },
			{ type: "thinking", content: "Thinking..." },
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
			}),
		);
		state = reduceAgentEvent(
			state,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true },
				state: "complete",
			}),
		);

		const assistant = state.messages.find(
			(message) => message.role === "assistant",
		);

		expect(assistant?.parts).toEqual([
			{
				type: "tool-call",
				id: "run-1:tool-call:0",
				name: "get_question",
				arguments: "{}",
				input: undefined,
				output: "{\n  \"ok\": true\n}",
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "run-1:tool-call:0",
				content: "{\n  \"ok\": true\n}",
				state: "complete",
				error: undefined,
			},
		]);
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
				parts: [{ type: "text", content: "system prompt" }],
			},
			{
				id: "run-1:user",
				role: "user",
				parts: [{ type: "text", content: "user prompt" }],
			},
			{
				id: "run-1:assistant",
				role: "assistant",
				parts: [{ type: "text", content: "" }],
			},
		]);
	});
});
