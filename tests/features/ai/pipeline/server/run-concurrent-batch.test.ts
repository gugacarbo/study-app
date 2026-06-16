import { describe, expect, it, vi } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
} from "@/features/ai/core/ui-message-job-stream";
import { consumeJobStreamFromResponse } from "@/features/ai/lib/read-job-ui-message-stream";
import { runConcurrentBatch } from "@/features/ai/pipeline/server/run-concurrent-batch";
import { createPipelineLogger } from "@/features/ai/pipeline/server/pipeline-logger";
import type { createAgentRunWriter } from "@/features/ai/core/ui-message-job-stream";

type AgentRunWriter = ReturnType<typeof createAgentRunWriter>;

function createMockAgentRuns(): AgentRunWriter {
	return {
		allocateAgentRunId: vi.fn((stageId: string) => `${stageId}-1`),
		createRun: vi.fn((stageId: string, label: string) => ({
			stageId,
			agentRunId: `${stageId}-1`,
			label,
		})),
		lifecycle: vi.fn(),
		warning: vi.fn(),
		result: vi.fn(),
		token: vi.fn(),
		textDelta: vi.fn(),
		reasoningDelta: vi.fn(),
		toolCall: vi.fn(),
		toolResult: vi.fn(),
	};
}

describe("runConcurrentBatch", () => {
	it("retries failed items up to maxAttempts", async () => {
		const attempts = new Map<number, number>();

		const { results, successCount, failureCount } = await runConcurrentBatch({
			items: [1, 2, 3],
			concurrency: 2,
			maxAttempts: 3,
			mapper: async (item, index, attempt) => {
				attempts.set(index, attempt);
				if (index === 1 && attempt < 3) {
					return { success: false, error: "transient" };
				}
				return { success: true, result: item * 10 };
			},
		});

		expect(results).toEqual([
			{ success: true, result: 10 },
			{ success: true, result: 20 },
			{ success: true, result: 30 },
		]);
		expect(successCount).toBe(3);
		expect(failureCount).toBe(0);
		expect(attempts.get(1)).toBe(3);
	});

	it("throws when all items fail on first cycle", async () => {
		await expect(
			runConcurrentBatch({
				items: ["a", "b"],
				concurrency: 2,
				mapper: async () => ({ success: false, error: "fail" }),
			}),
		).rejects.toThrow("All 2 items failed on the first cycle.");
	});

	it("marks agent runs error and warns on permanent failures", async () => {
		const agentRuns = createMockAgentRuns();
		const onWarning = vi.fn();
		const onProgress = vi.fn();

		const { successCount, failureCount } = await runConcurrentBatch({
			items: ["ok", "bad"],
			concurrency: 2,
			maxAttempts: 2,
			agentRuns,
			onWarning,
			onProgress,
			getRunForItem: (_item, index) => ({
				stageId: "review",
				agentRunId: `review-${index + 1}`,
				label: `Q${index + 1}`,
			}),
			mapper: async (_item, index) =>
				index === 0
					? { success: true, result: "done" }
					: { success: false, error: "permanent" },
		});

		expect(successCount).toBe(1);
		expect(failureCount).toBe(1);
		expect(onProgress).toHaveBeenCalledWith(
			"Retrying 1 failed item (attempt 2/2)...",
		);
		expect(agentRuns.lifecycle).toHaveBeenCalledWith(
			{ stageId: "review", agentRunId: "review-2", label: "Q2" },
			"error",
			{ error: "permanent" },
		);
		expect(onWarning).toHaveBeenCalledWith("Item 1 failed: permanent", {
			index: 1,
			error: "permanent",
		});
	});

	it("failFast aborts on first failing item", async () => {
		await expect(
			runConcurrentBatch({
				items: [1, 2],
				concurrency: 2,
				failFast: true,
				mapper: async (_item, index) =>
					index === 0
						? { success: true, result: "ok" }
						: { success: false, error: "boom" },
			}),
		).rejects.toThrow("boom");
	});

	it("logs batch completion via pipeline logger", async () => {
		const stream = createJobUIMessageStream({
			execute: async ({ writer }) => {
				const log = createPipelineLogger(writer, { stageId: "review" });
				await runConcurrentBatch({
					items: [1],
					concurrency: 1,
					log,
					mapper: async (item) => ({ success: true, result: item }),
				});
			},
		});
		const response = createJobUIMessageStreamResponse(stream);

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-process-log",
					data: expect.objectContaining({
						level: "info",
						message: "Batch complete: 1/1 succeeded",
					}),
				}),
			]),
		);
	});
});
