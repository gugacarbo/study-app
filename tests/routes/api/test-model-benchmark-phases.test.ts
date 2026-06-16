import { describe, expect, it } from "vitest";
import {
	BENCHMARK_PHASES,
	BENCHMARK_TEXT_SYSTEM,
	BENCHMARK_TOOL_SYSTEM,
} from "@/routes/api/test-model-benchmark/-phases";

describe("test-model-benchmark phases", () => {
	it("does not duplicate the system prompt inside the user message", () => {
		for (const phase of BENCHMARK_PHASES) {
			expect(phase.userMsg).not.toContain("You are a model benchmark assistant");
			expect(phase.userMsg).not.toContain("[System]");
			expect(phase.userMsg).not.toContain("[User]");
		}
	});

	it("keeps text and tool system prompts separate", () => {
		const toolPhases = BENCHMARK_PHASES.filter((phase) => phase.useTools);
		const textPhases = BENCHMARK_PHASES.filter((phase) => !phase.useTools);

		for (const phase of toolPhases) {
			expect(phase.system).toBe(BENCHMARK_TOOL_SYSTEM);
		}

		for (const phase of textPhases) {
			expect(phase.system).toContain(BENCHMARK_TEXT_SYSTEM);
		}
	});

	it("includes explicit one-shot tool instructions for tool phases", () => {
		for (const phase of BENCHMARK_PHASES.filter((phase) => phase.useTools)) {
			expect(phase.system).toContain("exactly once");
			expect(phase.system).toContain("After the tool result is delivered");
			expect(phase.system).toContain("reply immediately");
		}
	});
});
