import { describe, expect, it, vi } from "vitest";
import {
	createAgentEventEmitter,
	createPipelineAgentEmitter,
} from "@/features/ai/pipeline/server/agent-emitter";
import { bridgeAgentRunEvent } from "@/features/ai/core/bridge-agent-run-event";
import type { createAgentRunWriter } from "@/features/ai/core/ui-message-job-stream";

vi.mock("@/features/ai/core/bridge-agent-run-event", () => ({
	bridgeAgentRunEvent: vi.fn(),
}));

type AgentRunWriter = ReturnType<typeof createAgentRunWriter>;

function createMockAgentRuns(): AgentRunWriter {
	return {
		allocateAgentRunId: vi.fn((stageId: string) => `${stageId}-1`),
		createRun: vi.fn((stageId: string, label: string) => ({
			stageId,
			agentRunId: `${stageId}-1`,
			label,
		})),
		lifecycle: vi.fn(),
		warning: vi.fn(),
		result: vi.fn(),
		token: vi.fn(),
		textDelta: vi.fn(),
		reasoningDelta: vi.fn(),
		toolCall: vi.fn(),
		toolResult: vi.fn(),
	};
}

describe("createAgentEventEmitter", () => {
	it("bridges events with run descriptor fields", () => {
		const agentRuns = createMockAgentRuns();
		const run = {
			stageId: "review",
			agentRunId: "review-1",
			label: "Reviewer Q1",
		};
		const onWarning = vi.fn();

		const emit = createAgentEventEmitter(agentRuns, run, { onWarning });
		emit({
			eventType: "token",
			stageId: run.stageId,
			agentRunId: run.agentRunId,
			label: run.label,
			rawText: "hello",
		});

		expect(bridgeAgentRunEvent).toHaveBeenCalledWith(
			{
				eventType: "token",
				rawText: "hello",
				stageId: "review",
				agentRunId: "review-1",
				label: "Reviewer Q1",
			},
			agentRuns,
			expect.any(Function),
		);

		const warningHandler = vi.mocked(bridgeAgentRunEvent).mock.calls[0]?.[2];
		warningHandler?.("tool warning", { agentRunId: "review-1" });
		expect(onWarning).toHaveBeenCalledWith("tool warning", {
			agentRunId: "review-1",
		});
	});
});

describe("createPipelineAgentEmitter", () => {
	it("fills missing stage, run, and label fields", () => {
		const emit = vi.fn();
		const run = {
			stageId: "review",
			agentRunId: "review-1",
			label: "Reviewer Q1",
		};

		const pipelineEmit = createPipelineAgentEmitter("review", run, emit);
		pipelineEmit({
			eventType: "lifecycle",
			status: "running",
			stageId: "review",
			agentRunId: "review-1",
			label: "Reviewer Q1",
		});

		expect(emit).toHaveBeenCalledWith({
			eventType: "lifecycle",
			status: "running",
			stageId: "review",
			agentRunId: "review-1",
			label: "Reviewer Q1",
		});
	});

	it("preserves explicit event fields", () => {
		const emit = vi.fn();
		const run = {
			stageId: "review",
			agentRunId: "review-1",
			label: "Reviewer Q1",
		};

		const pipelineEmit = createPipelineAgentEmitter("review", run, emit);
		pipelineEmit({
			eventType: "lifecycle",
			status: "running",
			stageId: "custom",
			agentRunId: "custom-1",
			label: "Custom",
		});

		expect(emit).toHaveBeenCalledWith({
			eventType: "lifecycle",
			status: "running",
			stageId: "custom",
			agentRunId: "custom-1",
			label: "Custom",
		});
	});
});
