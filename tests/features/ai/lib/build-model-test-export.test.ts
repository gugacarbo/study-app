import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
	buildModelTestExport,
	serializeModelTestExport,
} from "#/features/ai/lib/build-model-test-export";

const sampleMessages: UIMessage[] = [
	{
		id: "system-1",
		role: "system",
		parts: [{ type: "text", text: "You are a connection test assistant." }],
	},
	{
		id: "user-1",
		role: "user",
		parts: [{ type: "text", text: "Say connection successful." }],
	},
	{
		id: "assistant-1",
		role: "assistant",
		parts: [{ type: "text", text: "Connection successful using model: test" }],
	},
];

describe("buildModelTestExport", () => {
	it("includes HTTP request and response for quick connection tests", () => {
		const json = buildModelTestExport({
			testMode: "quick",
			modelId: 7,
			modelLabel: "Test Model (openrouter)",
			testStatus: "success",
			testProgress: 100,
			testStep: "Completed",
			testError: "",
			tokenTotals: { prompt: 20, completion: 10, total: 30 },
			streamMetrics: {
				ttftMs: 120,
				tokensPerSecond: 40,
				totalRequestMs: 900,
			},
			messages: sampleMessages,
			logs: [{ id: "log-1", level: "info", message: "done", timestamp: 1 }],
			userPrompt: "Say connection successful.",
			responseText: "Connection successful using model: test",
		});

		expect(json.request).toEqual({
			endpoint: "/api/test-connection",
			method: "POST",
			body: { modelId: 7 },
			systemPrompt: "You are a connection test assistant.",
			userPrompt: "Say connection successful.",
		});
		expect(json.response.text).toBe(
			"Connection successful using model: test",
		);
		expect(json.response.messages).toEqual(sampleMessages);
		expect(json.response.tokenTotals).toEqual({
			prompt: 20,
			completion: 10,
			total: 30,
		});
		expect(json.logs).toEqual([
			{ id: "log-1", level: "info", message: "done", timestamp: 1 },
		]);
		expect(json.response.phases).toBeUndefined();
	});

	it("includes benchmark endpoint and phase summary", () => {
		const phases = [
			{
				phaseId: "text",
				label: "Text",
				ttftMs: 100,
				ttftToolMs: null,
				toolRoundTripMs: null,
				tokensPerSecond: 30,
				phaseDurationMs: 800,
				passed: true,
			},
		] as const;

		const json = buildModelTestExport({
			testMode: "benchmark",
			modelId: 3,
			modelLabel: "Benchmark model",
			testStatus: "error",
			testProgress: 100,
			testStep: "Tool phase failed",
			testError: "Expected 3, got 4",
			tokenTotals: null,
			phaseMetrics: [...phases],
			messages: sampleMessages,
		});

		expect(json.request.endpoint).toBe("/api/test-model-benchmark");
		expect(json.response.phases).toEqual(phases);
		expect(json.response.phaseSummary).toEqual({
			total: 1,
			passed: 1,
			failed: 0,
			pending: 0,
		});
		expect(json.test.error).toBe("Expected 3, got 4");
	});

	it("preserves stage status tool calls in exported messages", () => {
		const messages: UIMessage[] = [
			{
				id: "assistant-1",
				role: "assistant",
				parts: [
					{ type: "text", text: "Connection successful." },
					{
						type: "dynamic-tool",
						toolName: "report_agent_stage_status",
						toolCallId: "call-stage",
						state: "output-available",
						input: {
							status: "success",
							message: "Connection test completed successfully.",
						},
						output: {
							ok: true,
							status: "success",
							message: "Connection test completed successfully.",
						},
					},
				],
			},
		];

		const json = buildModelTestExport({
			testMode: "quick",
			modelId: 9,
			testStatus: "success",
			testProgress: 100,
			testStep: "Completed",
			testError: "",
			tokenTotals: null,
			messages,
		});

		const toolPart = json.response.messages[0]?.parts.find(
			(part) =>
				part.type === "dynamic-tool" &&
				part.toolName === "report_agent_stage_status",
		);

		expect(toolPart).toBeDefined();
	});
});

describe("serializeModelTestExport", () => {
	it("returns pretty-printed JSON", () => {
		const serialized = serializeModelTestExport({
			testMode: "quick",
			modelId: 1,
			testStatus: "success",
			testProgress: 100,
			testStep: "Completed",
			testError: "",
			tokenTotals: null,
			messages: sampleMessages,
		});
		const parsed = JSON.parse(serialized);

		expect(parsed.version).toBe(1);
		expect(serialized).toContain('\n  "request": {');
	});
});
