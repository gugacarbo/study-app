import { describe, expect, it } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
} from "@/features/ai/core/ui-message-job-stream";
import { consumeJobStreamFromResponse } from "@/features/ai/lib/read-job-ui-message-stream";
import { runPipelineStage, type PipelineStageOutcome } from "@/features/ai/pipeline/server/run-pipeline-stage";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("runPipelineStage", () => {
	it("writes running then done stage parts and logs lifecycle", async () => {
		const response = createJobResponse(async ({ writer }) => {
			await runPipelineStage(
				writer,
				{ stageId: "review", label: "Review" },
				async (): Promise<PipelineStageOutcome> => "done",
			);
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts).toEqual([
			expect.objectContaining({
				type: "data-process-log",
				data: expect.objectContaining({
					level: "info",
					message: "Review: running",
				}),
			}),
			expect.objectContaining({
				type: "data-stage",
				data: expect.objectContaining({
					stageId: "review",
					label: "Review",
					status: "running",
				}),
			}),
			expect.objectContaining({
				type: "data-process-log",
				data: expect.objectContaining({
					level: "info",
					message: "Review: done",
				}),
			}),
			expect.objectContaining({
				type: "data-stage",
				data: expect.objectContaining({
					stageId: "review",
					label: "Review",
					status: "done",
				}),
			}),
		]);
	});

	it("rethrows by default when work fails", async () => {
		const response = createJobResponse(async ({ writer }) => {
			await expect(
				runPipelineStage(
					writer,
					{ stageId: "extraction", label: "Extraction" },
					async () => {
						throw new Error("Extraction failed");
					},
				),
			).rejects.toThrow("Extraction failed");
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-stage",
					data: expect.objectContaining({
						status: "error",
						meta: { error: "Extraction failed" },
					}),
				}),
				expect.objectContaining({
					type: "data-process-log",
					data: expect.objectContaining({
						level: "error",
						message: "Extraction: error",
					}),
				}),
			]),
		);
	});

	it("returns error without rethrowing when fatal is false", async () => {
		const response = createJobResponse(async ({ writer }) => {
			const status = await runPipelineStage(
				writer,
				{ stageId: "review", label: "Review" },
				async () => {
					throw new Error("Question failed");
				},
				{ fatal: false },
			);
			expect(status).toBe("error");
		});

		await consumeJobStreamFromResponse(response);
	});

	it("updates pipeline ctx with stageId", async () => {
		const ctx: { stageId?: string } = {};

		const response = createJobResponse(async ({ writer }) => {
			await runPipelineStage(
				writer,
				{ stageId: "review", label: "Review" },
				async (): Promise<PipelineStageOutcome> => "skipped",
				{ ctx },
			);
		});

		await consumeJobStreamFromResponse(response);
		expect(ctx.stageId).toBe("review");
	});

	it("supports warning and skipped outcomes", async () => {
		const response = createJobResponse(async ({ writer }) => {
			await runPipelineStage(
				writer,
				{ stageId: "review", label: "Review" },
				async (): Promise<PipelineStageOutcome> => "warning",
			);
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		const finalStage = dataParts
			.filter((part) => part.type === "data-stage")
			.at(-1);

		expect(finalStage).toEqual(
			expect.objectContaining({
				type: "data-stage",
				data: expect.objectContaining({ status: "warning" }),
			}),
		);
	});
});
