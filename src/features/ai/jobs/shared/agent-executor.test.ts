import { describe, expect, it, vi } from "vitest";
import {
	AgentTimeoutError,
	computeRetryDelay,
	DEFAULT_AGENT_RETRY_CONFIG,
	executeAgentWithRetry,
} from "@/features/ai/jobs/shared/agent-executor";

describe("agent-executor", () => {
	describe("computeRetryDelay", () => {
		it("starts at baseDelayMs and doubles each attempt up to maxDelayMs", () => {
			expect(computeRetryDelay(1, DEFAULT_AGENT_RETRY_CONFIG)).toBe(500);
			expect(computeRetryDelay(2, DEFAULT_AGENT_RETRY_CONFIG)).toBe(1_000);
			expect(computeRetryDelay(3, DEFAULT_AGENT_RETRY_CONFIG)).toBe(2_000);
		});

		it("caps at maxDelayMs", () => {
			const config = {
				...DEFAULT_AGENT_RETRY_CONFIG,
				baseDelayMs: 50_000,
				backoffMultiplier: 2,
				maxDelayMs: 60_000,
			};
			expect(computeRetryDelay(2, config)).toBe(60_000);
		});
	});

	describe("executeAgentWithRetry", () => {
		it("returns the result on first successful attempt", async () => {
			const execute = vi.fn(async () => "ok");
			const buildContinueContext = vi.fn();
			const sleep = vi.fn();

			const result = await executeAgentWithRetry({
				execute,
				buildContinueContext,
				sleep,
			});

			expect(result).toBe("ok");
			expect(execute).toHaveBeenCalledTimes(1);
			expect(sleep).not.toHaveBeenCalled();
		});

		it("retries up to maxRetries with increasing delays and passes continue context", async () => {
			const execute = vi
				.fn()
				.mockRejectedValueOnce(new Error("first"))
				.mockRejectedValueOnce(new Error("second"))
				.mockResolvedValueOnce("ok");

			const buildContinueContext = vi.fn((error, context) => {
				return `${error instanceof Error ? error.message : "?"}:${context.length}`;
			});
			const sleep = vi.fn();
			const onRetry = vi.fn();

			const result = await executeAgentWithRetry({
				execute,
				buildContinueContext,
				sleep,
				onRetry,
			});

			expect(result).toBe("ok");
			expect(execute).toHaveBeenCalledTimes(3);
			expect(sleep).toHaveBeenCalledTimes(2);
			expect(sleep).toHaveBeenNthCalledWith(1, 500);
			expect(sleep).toHaveBeenNthCalledWith(2, 1_000);
			expect(buildContinueContext).toHaveBeenCalledTimes(2);
			expect(onRetry).toHaveBeenCalledTimes(2);
		});

		it("throws the last error after exhausting retries", async () => {
			const execute = vi.fn(async () => {
				throw new Error("boom");
			});
			const buildContinueContext = vi.fn(() => "context");
			const sleep = vi.fn();

			await expect(
				executeAgentWithRetry({
					execute,
					buildContinueContext,
					sleep,
				}),
			).rejects.toThrow("boom");

			expect(execute).toHaveBeenCalledTimes(DEFAULT_AGENT_RETRY_CONFIG.maxRetries + 1);
			expect(sleep).toHaveBeenCalledTimes(DEFAULT_AGENT_RETRY_CONFIG.maxRetries);
		});

		it("aborts with AgentTimeoutError when the execution exceeds timeoutMs", async () => {
			const execute = vi.fn(async ({ abortSignal }) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				if (abortSignal.aborted) {
					throw abortSignal.reason;
				}
				return "ok";
			});
			const buildContinueContext = vi.fn();
			const sleep = vi.fn();

			await expect(
				executeAgentWithRetry({
					execute,
					buildContinueContext,
					sleep,
					config: { timeoutMs: 1 },
				}),
			).rejects.toBeInstanceOf(AgentTimeoutError);

			expect(execute).toHaveBeenCalledTimes(DEFAULT_AGENT_RETRY_CONFIG.maxRetries + 1);
		});

		it("uses a custom retry config when provided", async () => {
			const execute = vi
				.fn()
				.mockRejectedValueOnce(new Error("first"))
				.mockResolvedValueOnce("ok");
			const buildContinueContext = vi.fn();
			const sleep = vi.fn();

			await executeAgentWithRetry({
				execute,
				buildContinueContext,
				sleep,
				config: {
					retry: { maxRetries: 1, baseDelayMs: 100 },
				},
			});

			expect(execute).toHaveBeenCalledTimes(2);
			expect(sleep).toHaveBeenCalledTimes(1);
			expect(sleep).toHaveBeenCalledWith(100);
		});
	});
});
