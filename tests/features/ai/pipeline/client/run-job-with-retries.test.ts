import { describe, expect, it, vi } from "vitest";
import { runJobWithRetries } from "@/features/ai/pipeline/client/run-job-with-retries";

describe("runJobWithRetries", () => {
	it("retries retryable stream errors up to maxAttempts", async () => {
		const run = vi
			.fn()
			.mockRejectedValueOnce(new Error("network"))
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce(undefined);

		const onLog = vi.fn();
		await runJobWithRetries({
			maxAttempts: 3,
			backoffMs: () => 0,
			onLog,
			run,
		});

		expect(run).toHaveBeenCalledTimes(3);
		expect(onLog).toHaveBeenCalledTimes(2);
		expect(onLog.mock.calls[0]?.[0]?.message).toContain("Attempt 1/3 failed");
	});

	it("does not retry non-retryable http failures", async () => {
		const run = vi
			.fn()
			.mockRejectedValue(new Error("Job stream request failed (400)"));

		await expect(
			runJobWithRetries({
				maxAttempts: 3,
				backoffMs: () => 0,
				run,
			}),
		).rejects.toThrow("Job stream request failed (400)");

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("rethrows abort errors immediately", async () => {
		const run = vi
			.fn()
			.mockRejectedValue(new DOMException("Aborted", "AbortError"));

		await expect(
			runJobWithRetries({
				maxAttempts: 3,
				signal: new AbortController().signal,
				run,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});
