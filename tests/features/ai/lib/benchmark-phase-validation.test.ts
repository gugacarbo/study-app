import { describe, expect, it } from "vitest";
import {
	SUSTAINED_TEXT_MIN_CHARS,
	validateBenchmarkPhase,
} from "@/features/ai/lib/benchmark-phase-validation";

describe("validateBenchmarkPhase", () => {
	it("passes text baseline when response is non-empty", () => {
		expect(validateBenchmarkPhase("text_baseline", "ready", [])).toBe(true);
		expect(validateBenchmarkPhase("text_baseline", "   ", [])).toBe(false);
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

	it("passes sustained text when completion is long enough", () => {
		const longText = "a".repeat(SUSTAINED_TEXT_MIN_CHARS);
		expect(validateBenchmarkPhase("sustained_text", longText, [])).toBe(true);
		expect(
			validateBenchmarkPhase(
				"sustained_text",
				"a".repeat(SUSTAINED_TEXT_MIN_CHARS - 1),
				[],
			),
		).toBe(false);
	});
});
