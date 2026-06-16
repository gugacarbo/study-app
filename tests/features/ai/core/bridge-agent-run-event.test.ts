import { describe, expect, it, vi } from "vitest";
import {
	bridgeAgentRunEvent,
	normalizeAgentStatus,
} from "@/features/ai/core/bridge-agent-run-event";

describe("bridgeAgentRunEvent", () => {
	it("routes rawText token events to textDelta", () => {
		const agentRuns = {
			lifecycle: vi.fn(),
			warning: vi.fn(),
			result: vi.fn(),
			token: vi.fn(),
			textDelta: vi.fn(),
			reasoningDelta: vi.fn(),
			toolCall: vi.fn(),
			toolResult: vi.fn(),
		};

		bridgeAgentRunEvent(
			{
				eventType: "token",
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
				rawText: "Checking question...",
			},
			agentRuns,
		);

		expect(agentRuns.textDelta).toHaveBeenCalledWith(
			{
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
			},
			"Checking question...",
		);
		expect(agentRuns.token).not.toHaveBeenCalled();
	});

	it("routes reasoning token events to reasoningDelta", () => {
		const agentRuns = {
			lifecycle: vi.fn(),
			warning: vi.fn(),
			result: vi.fn(),
			token: vi.fn(),
			textDelta: vi.fn(),
			reasoningDelta: vi.fn(),
			toolCall: vi.fn(),
			toolResult: vi.fn(),
		};

		bridgeAgentRunEvent(
			{
				eventType: "token",
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
				rawText: "Thinking...",
				meta: { kind: "reasoning" },
			},
			agentRuns,
		);

		expect(agentRuns.reasoningDelta).toHaveBeenCalledWith(
			{
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
			},
			"Thinking...",
		);
	});

	it("forwards usage token events to token()", () => {
		const agentRuns = {
			lifecycle: vi.fn(),
			warning: vi.fn(),
			result: vi.fn(),
			token: vi.fn(),
			textDelta: vi.fn(),
			reasoningDelta: vi.fn(),
			toolCall: vi.fn(),
			toolResult: vi.fn(),
		};

		bridgeAgentRunEvent(
			{
				eventType: "token",
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
				tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			},
			agentRuns,
		);

		expect(agentRuns.token).toHaveBeenCalledWith(
			{
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
			},
			{ inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			undefined,
		);
	});
});

describe("normalizeAgentStatus", () => {
	it("defaults unknown statuses to running", () => {
		expect(normalizeAgentStatus("unknown")).toBe("running");
		expect(normalizeAgentStatus("done")).toBe("done");
	});
});
