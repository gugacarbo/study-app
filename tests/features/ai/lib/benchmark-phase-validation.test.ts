import { describe, expect, it } from "vitest";
import {
	SUSTAINED_TEXT_MIN_CHARS,
	type BenchmarkToolCallRecord,
	validateBenchmarkPhase,
} from "@/features/ai/lib/benchmark-phase-validation";

const stageStatusCall: BenchmarkToolCallRecord = {
	name: "report_agent_stage_status",
};

function withStageStatus(calls: BenchmarkToolCallRecord[]): BenchmarkToolCallRecord[] {
	return [...calls, stageStatusCall];
}

describe("validateBenchmarkPhase", () => {
	it("passes text baseline when response contains ready and stage status is reported", () => {
		expect(
			validateBenchmarkPhase("text_baseline", "I am ready.", [stageStatusCall]),
		).toBe(true);
		expect(validateBenchmarkPhase("text_baseline", "   ", [stageStatusCall])).toBe(
			false,
		);
		expect(validateBenchmarkPhase("text_baseline", "ok", [stageStatusCall])).toBe(
			false,
		);
		expect(validateBenchmarkPhase("text_baseline", "I am ready.", [])).toBe(
			false,
		);
	});

	it("passes tool math when add_numbers is used and response contains 42", () => {
		expect(
			validateBenchmarkPhase(
				"tool_math",
				"The answer is 42",
				withStageStatus([{ name: "add_numbers", input: { a: 17, b: 25 } }]),
			),
		).toBe(true);
		expect(
			validateBenchmarkPhase(
				"tool_math",
				"41",
				withStageStatus([{ name: "add_numbers", input: { a: 17, b: 25 } }]),
			),
		).toBe(false);
		expect(validateBenchmarkPhase("tool_math", "42", [stageStatusCall])).toBe(
			false,
		);
	});

	it("passes tool math when the tool output returns 42 even without a final numeric reply", () => {
		expect(
			validateBenchmarkPhase(
				"tool_math",
				"",
				withStageStatus([
					{
						name: "add_numbers",
						input: { a: 17, b: 25 },
						output: { sum: 42 },
					},
				]),
			),
		).toBe(true);
		expect(
			validateBenchmarkPhase(
				"tool_math",
				'{"status":"ok"}',
				withStageStatus([
					{
						name: "add_numbers",
						input: { a: 17, b: 25 },
						output: '{"sum":42}',
					},
				]),
			),
		).toBe(true);
	});

	it("passes tool echo when echo is used and response cites benchmark", () => {
		expect(
			validateBenchmarkPhase(
				"tool_echo",
				"Echo returned benchmark",
				withStageStatus([{ name: "echo", input: { message: "benchmark" } }]),
			),
		).toBe(true);
		expect(
			validateBenchmarkPhase(
				"tool_echo",
				"missing word",
				withStageStatus([{ name: "echo", input: { message: "benchmark" } }]),
			),
		).toBe(false);
	});

	it("passes tool echo when echo output contains benchmark even without a matching reply", () => {
		expect(
			validateBenchmarkPhase(
				"tool_echo",
				"",
				withStageStatus([
					{
						name: "echo",
						input: { message: "benchmark" },
						output: { message: "benchmark" },
					},
				]),
			),
		).toBe(true);
	});

	it("passes sustained text when completion has four bullets or enough characters", () => {
		const longText = "a".repeat(SUSTAINED_TEXT_MIN_CHARS);
		expect(
			validateBenchmarkPhase("sustained_text", longText, [stageStatusCall]),
		).toBe(true);
		expect(
			validateBenchmarkPhase(
				"sustained_text",
				[
					"- Latency is time to first token.",
					"- Throughput is tokens per second.",
					"- Batching improves throughput.",
					"- Hardware affects both metrics.",
				].join("\n"),
				[stageStatusCall],
			),
		).toBe(true);
		expect(
			validateBenchmarkPhase(
				"sustained_text",
				"a".repeat(SUSTAINED_TEXT_MIN_CHARS - 1),
				[stageStatusCall],
			),
		).toBe(false);
	});
});
