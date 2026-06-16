import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeAgentRun,
	writeJobError,
	writeJobProgress,
	writeJobResult,
	writeProcessLog,
	writeStage,
} from "@/features/ai/core/ui-message-job-stream";
import { runJobPipeline } from "@/features/ai/pipeline/client/run-job-pipeline";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("runJobPipeline", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("dispatches typed handlers and auto-logs", async () => {
		const response = createJobResponse(({ writer }) => {
			writeStage(writer, {
				stageId: "extract",
				label: "Extract",
				status: "running",
			});
			writeJobProgress(writer, { step: "Parsing PDF", percent: 10 });
			writeProcessLog(writer, {
				level: "info",
				message: "Custom log",
				timestamp: 99,
			});
			writeAgentRun(writer, {
				agentRunId: "extract-1",
				stageId: "extract",
				label: "Extractor",
				eventType: "lifecycle",
				status: "running",
				timestamp: 1,
			});
			writeJobResult(writer, { questions: 2 });
		});

		vi.spyOn(globalThis, "fetch").mockResolvedValue(response.clone());

		const stages: string[] = [];
		const logs: PipelineLogEntry[] = [];
		let receivedResult = false;

		const result = await runJobPipeline({
			request: {
				url: "/api/ingest",
				init: { method: "POST", body: "{}" },
			},
			handlers: {
				onStage: (_ctx, data) => {
					stages.push(data.stageId);
				},
				onAgentRun: (_ctx, data) => {
					expect(data.agentRunId).toBe("extract-1");
				},
				onProgress: (_ctx, data) => {
					expect(data.step).toBe("Parsing PDF");
				},
				onResult: () => {
					receivedResult = true;
				},
				onLog: (entry) => {
					logs.push(entry);
				},
			},
		});

		expect(stages).toEqual(["extract"]);
		expect(receivedResult).toBe(true);
		expect(logs.some((entry) => entry.message === "Custom log")).toBe(true);
		expect(logs.some((entry) => entry.message === "Parsing PDF")).toBe(true);
		expect(result.messages[0]?.parts.map((part) => part.type)).toEqual(
			expect.arrayContaining(["data-stage", "data-agent-run", "data-job-result"]),
		);
	});

	it("calls onError before throwing for data-job-error", async () => {
		const response = createJobResponse(({ writer }) => {
			writeJobError(writer, {
				message: "Ingest failed",
				stageId: "extract",
				agentRunId: "extract-1",
			});
		});

		vi.spyOn(globalThis, "fetch").mockResolvedValue(response.clone());

		const errors: PipelineErrorState[] = [];
		await expect(
			runJobPipeline({
				request: { url: "/api/ingest" },
				onError: (error) => {
					errors.push(error);
				},
			}),
		).rejects.toThrow("Ingest failed");

		expect(errors).toEqual([
			{
				message: "Ingest failed",
				source: "job-error",
				stageId: "extract",
				agentRunId: "extract-1",
				retryable: false,
			},
		]);
	});

	it("throws incomplete when expectResult is true and no job result arrives", async () => {
		const response = createJobResponse(({ writer }) => {
			writeJobProgress(writer, { step: "Working", percent: 50 });
		});

		vi.spyOn(globalThis, "fetch").mockResolvedValue(response.clone());

		const errors: PipelineErrorState[] = [];
		await expect(
			runJobPipeline({
				request: { url: "/api/ingest" },
				expectResult: true,
				onError: (error) => {
					errors.push(error);
				},
			}),
		).rejects.toThrow("Job stream finished without a job result");

		expect(errors[0]).toMatchObject({
			source: "incomplete",
			retryable: false,
		});
	});
});
