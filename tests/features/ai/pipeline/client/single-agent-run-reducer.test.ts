import { describe, expect, it } from "vitest";
import {
	applyAgentRunPart,
	createSingleAgentRunState,
	syncAgentRunId,
} from "@/features/ai/pipeline/client/single-agent-run-reducer";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";

function lifecycleEvent(
	overrides: Partial<AgentRunDataPart> = {},
): AgentRunDataPart {
	return {
		agentRunId: "run-1",
		stageId: "stage-1",
		label: "Agent",
		eventType: "lifecycle",
		timestamp: 1,
		status: "running",
		systemPrompt: "system",
		userPrompt: "user",
		...overrides,
	};
}

describe("single-agent-run-reducer", () => {
	it("syncAgentRunId updates metadata when agentRunId changes", () => {
		const state = createSingleAgentRunState({
			agentRunId: "run-1",
			label: "First",
		});

		const next = syncAgentRunId(state, {
			agentRunId: "run-2",
			label: "Retry",
			systemPrompt: "next-system",
			userPrompt: "next-user",
		});

		expect(next).toMatchObject({
			agentRunId: "run-2",
			label: "Retry",
			systemPrompt: "next-system",
			userPrompt: "next-user",
		});
	});

	it("applyAgentRunPart appends token text to assistant output", () => {
		let state = createSingleAgentRunState({
			agentRunId: "run-1",
			label: "Agent",
			systemPrompt: "system",
			userPrompt: "user",
		});

		state = applyAgentRunPart(
			state,
			lifecycleEvent({ status: "running", systemPrompt: "system", userPrompt: "user" }),
		);
		state = applyAgentRunPart(
			state,
			lifecycleEvent({
				eventType: "token",
				rawText: "Hello",
				meta: { kind: "text" },
			}),
		);

		expect(state.outputText).toBe("Hello");
		expect(
			state.messages
				.find((message) => message.role === "assistant")
				?.parts.some((part) => part.type === "text" && part.text === "Hello"),
		).toBe(true);
	});

	it("applyAgentRunPart records lifecycle errors", () => {
		let state = createSingleAgentRunState({
			agentRunId: "run-1",
			label: "Agent",
		});

		state = applyAgentRunPart(
			state,
			lifecycleEvent({
				status: "error",
				error: "Agent failed",
			}),
		);

		expect(state.status).toBe("error");
		expect(state.error).toBe("Agent failed");
	});
});
