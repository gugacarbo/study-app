import { describe, expect, it, vi } from "vitest";
import {
	catchPipelineError,
	isAbortError,
} from "@/features/ai/pipeline/client/catch-pipeline-error";

describe("catchPipelineError", () => {
	it("isAbortError recognizes DOMException AbortError", () => {
		expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
		expect(isAbortError(new Error("nope"))).toBe(false);
	});

	it("sets canceled patch for abort without streamError", () => {
		const patchProcess = vi.fn();
		const result = catchPipelineError(
			new DOMException("Aborted", "AbortError"),
			new AbortController().signal,
			patchProcess,
		);

		expect(result).toBeNull();
		expect(patchProcess).toHaveBeenCalledWith({
			phase: "canceled",
			isStreaming: false,
			streamError: null,
		});
	});

	it("sets streamError and error phase for other failures", () => {
		const patchProcess = vi.fn();
		const result = catchPipelineError(
			new Error("Network failed"),
			undefined,
			patchProcess,
			{ agentRunState: { status: "running", error: null } },
		);

		expect(result).toMatchObject({
			message: "Network failed",
			source: "stream",
			retryable: true,
		});
		expect(patchProcess).toHaveBeenCalledWith({
			streamError: "Network failed",
			phase: "error",
			isStreaming: false,
			agentRunState: {
				status: "error",
				error: "Network failed",
			},
		});
	});
});
