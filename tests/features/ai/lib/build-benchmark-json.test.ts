import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	buildBenchmarkJson,
	serializeBenchmarkJson,
} from "#/features/ai/lib/build-benchmark-json";

const samplePhases = [
	{
		phaseId: "text",
		label: "Text",
		ttftMs: 120,
		ttftToolMs: null,
		toolRoundTripMs: null,
		tokensPerSecond: 45,
		phaseDurationMs: 900,
		passed: true,
	},
	{
		phaseId: "tool_math",
		label: "Tool math",
		ttftMs: 200,
		ttftToolMs: 180,
		toolRoundTripMs: 50,
		tokensPerSecond: 30,
		phaseDurationMs: 1200,
		passed: false,
	},
] as const;

const sampleMessages: UIMessage[] = [
	{
		id: "user-1",
		role: "user",
		parts: [{ type: "text", text: "Hello" }],
	},
	{
		id: "assistant-1",
		role: "assistant",
		parts: [
			{
				type: "dynamic-tool",
				toolName: "add_numbers",
				toolCallId: "call-1",
				state: "output-available",
				input: { a: 1, b: 2 },
				output: { sum: 3 },
			},
		],
	},
];

const baseInput = {
	modelLabel: "Test Model (openrouter)",
	testStatus: "error" as const,
	testProgress: 100,
	testStep: "Tool math phase failed",
	testError: "Expected tool output 3, got 4",
	tokenTotals: { prompt: 100, completion: 50, total: 150 },
	streamMetrics: {
		ttftMs: 150,
		tokensPerSecond: 40,
		totalRequestMs: 2100,
	},
	phases: [...samplePhases],
	messages: sampleMessages,
	inputCostPerMillion: 1,
	outputCostPerMillion: 2,
};

describe("buildBenchmarkJson", () => {
	it("includes model, test state, metrics, and transcript", () => {
		const json = buildBenchmarkJson(baseInput);

		expect(json.version).toBe(1);
		expect(json.model).toEqual({
			label: "Test Model (openrouter)",
			inputCostPerMillion: 1,
			outputCostPerMillion: 2,
		});
		expect(json.test).toEqual({
			mode: "benchmark",
			status: "error",
			progress: 100,
			step: "Tool math phase failed",
			error: "Expected tool output 3, got 4",
		});
		expect(json.metrics.stream).toEqual(baseInput.streamMetrics);
		expect(json.metrics.tokens).toEqual(baseInput.tokenTotals);
		expect(json.metrics.phases).toEqual(samplePhases);
		expect(json.metrics.phaseSummary).toEqual({
			total: 2,
			passed: 1,
			failed: 1,
			pending: 0,
		});
		expect(json.messages).toEqual(sampleMessages);
	});

	it("computes cost estimate from token totals and pricing", () => {
		const json = buildBenchmarkJson(baseInput);

		expect(json.metrics.costEstimate).toEqual({
			input: 0.0001,
			output: 0.0001,
			total: 0.0002,
		});
	});

	it("normalizes empty error to null", () => {
		const json = buildBenchmarkJson({
			...baseInput,
			testError: "   ",
		});

		expect(json.test.error).toBeNull();
	});
});

describe("serializeBenchmarkJson", () => {
	it("returns pretty-printed JSON", () => {
		const serialized = serializeBenchmarkJson(baseInput);
		const parsed = JSON.parse(serialized);

		expect(parsed).toEqual(buildBenchmarkJson(baseInput));
		expect(serialized).toContain('\n  "version": 1');
	});
});
