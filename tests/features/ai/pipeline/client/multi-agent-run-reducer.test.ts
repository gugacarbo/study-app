import { describe, expect, it } from "vitest";
import {
	applyAgentRunPartToMulti,
	createMultiAgentRunState,
	rebuildMultiAgentMessages,
} from "@/features/ai/pipeline/client/multi-agent-run-reducer";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";

describe("multi-agent-run-reducer", () => {
	it("tracks multiple agent runs and rebuilds messages in insertion order", () => {
		let state = createMultiAgentRunState();

		const pendingA: AgentRunDataPart = {
			agentRunId: "a",
			stageId: "phase-1",
			label: "Phase A",
			eventType: "lifecycle",
			timestamp: 1,
			status: "pending",
			systemPrompt: "sys-a",
			userPrompt: "user-a",
		};
		const pendingB: AgentRunDataPart = {
			agentRunId: "b",
			stageId: "phase-2",
			label: "Phase B",
			eventType: "lifecycle",
			timestamp: 2,
			status: "pending",
			systemPrompt: "sys-b",
			userPrompt: "user-b",
		};

		state = applyAgentRunPartToMulti(state, pendingA);
		state = applyAgentRunPartToMulti(state, pendingB);
		state = applyAgentRunPartToMulti(state, {
			...pendingA,
			eventType: "token",
			rawText: "A text",
			meta: { kind: "text" },
		});
		state = applyAgentRunPartToMulti(state, {
			...pendingB,
			eventType: "token",
			rawText: "B text",
			meta: { kind: "text" },
		});

		const messages = rebuildMultiAgentMessages(state);
		expect(messages).toHaveLength(6);
		expect(messages.filter((message) => message.role === "assistant")).toHaveLength(2);
		expect(state.runs.get("a")?.outputText).toBe("A text");
		expect(state.runs.get("b")?.outputText).toBe("B text");
	});
});
