import { describe, expect, it } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
} from "@/features/ai/core/ui-message-job-stream";
import { consumeJobStreamFromResponse } from "@/features/ai/lib/read-job-ui-message-stream";
import { createPipelineLogger } from "@/features/ai/pipeline/server/pipeline-logger";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("createPipelineLogger", () => {
	it("writes process-log parts with context", async () => {
		const response = createJobResponse(({ writer }) => {
			const log = createPipelineLogger(writer, {
				stageId: "review",
				agentRunId: "review-1",
			});
			log.info("Running review...");
			log.warning("Question 12 skipped", { questionId: 12 });
			log.error("Extraction failed", { error: "timeout" });
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts).toEqual([
			expect.objectContaining({
				type: "data-process-log",
				data: {
					level: "info",
					message: "Running review...",
					stageId: "review",
					agentRunId: "review-1",
					timestamp: expect.any(Number),
				},
			}),
			expect.objectContaining({
				type: "data-process-log",
				data: expect.objectContaining({
					level: "warning",
					message: "Question 12 skipped",
					data: { questionId: 12 },
				}),
			}),
			expect.objectContaining({
				type: "data-process-log",
				data: expect.objectContaining({
					level: "error",
					message: "Extraction failed",
					data: { error: "timeout" },
				}),
			}),
		]);
	});

	it("step writes job-progress and process log", async () => {
		const response = createJobResponse(({ writer }) => {
			const log = createPipelineLogger(writer, { stageId: "benchmark" });
			log.step("Running baseline...", 25);
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts).toEqual([
			expect.objectContaining({
				type: "data-job-progress",
				data: {
					step: "Running baseline...",
					percent: 25,
					stageId: "benchmark",
				},
			}),
			expect.objectContaining({
				type: "data-process-log",
				data: expect.objectContaining({
					level: "info",
					message: "Running baseline...",
				}),
			}),
		]);
	});

	it("withContext merges logger context", async () => {
		const response = createJobResponse(({ writer }) => {
			const log = createPipelineLogger(writer, { stageId: "review" }).withContext({
				agentRunId: "review-2",
			});
			log.info("Per-question review");
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts[0]).toEqual(
			expect.objectContaining({
				type: "data-process-log",
				data: expect.objectContaining({
					stageId: "review",
					agentRunId: "review-2",
					message: "Per-question review",
				}),
			}),
		);
	});
});
