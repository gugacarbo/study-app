import { describe, expect, it } from "vitest";
import {
	SUSTAINED_TEXT_MIN_CHARS,
	validateBenchmarkPhase,
} from "@/features/ai/lib/benchmark-phase-validation";

describe("validateBenchmarkPhase", () => {
	it("passes text baseline when response contains ready", () => {
		expect(validateBenchmarkPhase("text_baseline", "I am ready.", [])).toBe(
			true,
		);
		expect(validateBenchmarkPhase("text_baseline", "   ", [])).toBe(false);
		expect(validateBenchmarkPhase("text_baseline", "ok", [])).toBe(false);
	});

	it("passes tool math when add_numbers is used and response contains 42", () => {
		expect(
			validateBenchmarkPhase("tool_math", "The answer is 42", [
				{ name: "add_numbers", input: { a: 17, b: 25 } },
			]),
		).toBe(true);
		expect(
			validateBenchmarkPhase("tool_math", "41", [
				{ name: "add_numbers", input: { a: 17, b: 25 } },
			]),
		).toBe(false);
		expect(validateBenchmarkPhase("tool_math", "42", [])).toBe(false);
	});

	it("passes tool math when the tool output returns 42 even without a final numeric reply", () => {
		expect(
			validateBenchmarkPhase("tool_math", "", [
				{
					name: "add_numbers",
					input: { a: 17, b: 25 },
					output: { sum: 42 },
				},
			]),
		).toBe(true);
		expect(
			validateBenchmarkPhase("tool_math", '{"status":"ok"}', [
				{
					name: "add_numbers",
					input: { a: 17, b: 25 },
					output: '{"sum":42}',
				},
			]),
		).toBe(true);
	});

	it("passes tool echo when echo is used and response cites benchmark", () => {
		expect(
			validateBenchmarkPhase("tool_echo", "Echo returned benchmark", [
				{ name: "echo", input: { message: "benchmark" } },
			]),
		).toBe(true);
		expect(
			validateBenchmarkPhase("tool_echo", "missing word", [
				{ name: "echo", input: { message: "benchmark" } },
			]),
		).toBe(false);
	});

	it("passes tool echo when echo output contains benchmark even without a matching reply", () => {
		expect(
			validateBenchmarkPhase("tool_echo", "", [
				{
					name: "echo",
					input: { message: "benchmark" },
					output: { message: "benchmark" },
				},
			]),
		).toBe(true);
	});

	it("passes sustained text when completion has four bullets or enough characters", () => {
		const longText = "a".repeat(SUSTAINED_TEXT_MIN_CHARS);
		expect(validateBenchmarkPhase("sustained_text", longText, [])).toBe(true);
		expect(
			validateBenchmarkPhase(
				"sustained_text",
				[
					"- Latency is time to first token.",
					"- Throughput is tokens per second.",
					"- Batching improves throughput.",
					"- Hardware affects both metrics.",
				].join("\n"),
				[],
			),
		).toBe(true);
		expect(
			validateBenchmarkPhase(
				"sustained_text",
				"a".repeat(SUSTAINED_TEXT_MIN_CHARS - 1),
				[],
			),
		).toBe(false);
	});
});
