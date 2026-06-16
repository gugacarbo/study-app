import { describe, expect, it } from "vitest";
import { resolvePipelineError } from "@/features/ai/pipeline/client/resolve-pipeline-error";

describe("resolvePipelineError", () => {
	it("prefers streamError over agentRunState.error", () => {
		expect(
			resolvePipelineError({
				streamError: "Stream failed",
				agentRunState: { error: "Agent failed" },
			}),
		).toBe("Stream failed");
	});

	it("falls back to job error then agent error", () => {
		expect(
			resolvePipelineError({
				error: "Job failed",
				agentRunState: { error: "Agent failed" },
			}),
		).toBe("Job failed");

		expect(
			resolvePipelineError({
				agentRunState: { error: "Agent failed" },
			}),
		).toBe("Agent failed");
	});
});
