import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	extractAgentRunIdFromMessageId,
	filterBenchmarkMessagesByPhase,
} from "#/features/ai/lib/filter-benchmark-messages";
import type { BenchmarkPhaseMetrics } from "#/features/ai/lib/stream-perf-metrics";

const phases: BenchmarkPhaseMetrics[] = [
	{
		phaseId: "text_baseline",
		agentRunId: "model-benchmark-1",
		label: "Text baseline",
		ttftMs: 100,
		ttftToolMs: null,
		toolRoundTripMs: null,
		tokensPerSecond: 40,
		phaseDurationMs: 800,
		passed: true,
	},
	{
		phaseId: "tool_math",
		agentRunId: "model-benchmark-2",
		label: "Tool math",
		ttftMs: 200,
		ttftToolMs: 180,
		toolRoundTripMs: 50,
		tokensPerSecond: 30,
		phaseDurationMs: 1200,
		passed: false,
	},
];

function runMessages(runId: string): UIMessage[] {
	return [
		{
			id: `${runId}:user`,
			role: "user",
			parts: [{ type: "text", text: `prompt-${runId}` }],
		},
		{
			id: `${runId}:assistant`,
			role: "assistant",
			parts: [{ type: "text", text: `reply-${runId}` }],
		},
	];
}

const messages: UIMessage[] = [
	...runMessages("model-benchmark-1"),
	...runMessages("model-benchmark-2"),
];

describe("extractAgentRunIdFromMessageId", () => {
	it("extracts the run id prefix before the role suffix", () => {
		expect(extractAgentRunIdFromMessageId("model-benchmark-2:assistant")).toBe(
			"model-benchmark-2",
		);
	});

	it("returns null when the id has no role suffix", () => {
		expect(extractAgentRunIdFromMessageId("plain-id")).toBeNull();
	});
});

describe("filterBenchmarkMessagesByPhase", () => {
	it("returns all messages when no phase is selected", () => {
		expect(filterBenchmarkMessagesByPhase(messages, null, phases)).toEqual(
			messages,
		);
	});

	it("filters messages by agentRunId on the selected phase", () => {
		expect(
			filterBenchmarkMessagesByPhase(messages, "tool_math", phases),
		).toEqual(runMessages("model-benchmark-2"));
	});

	it("falls back to phase order when agentRunId is missing", () => {
		const phasesWithoutRunIds = phases.map(({ agentRunId: _agentRunId, ...phase }) => phase);

		expect(
			filterBenchmarkMessagesByPhase(
				messages,
				"text_baseline",
				phasesWithoutRunIds,
			),
		).toEqual(runMessages("model-benchmark-1"));
	});

	it("returns all messages when the phase cannot be resolved", () => {
		expect(
			filterBenchmarkMessagesByPhase(messages, "missing", phases),
		).toEqual(messages);
	});
});
