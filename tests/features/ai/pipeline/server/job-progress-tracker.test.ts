import { describe, expect, it } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
} from "@/features/ai/core/ui-message-job-stream";
import { consumeJobStreamFromResponse } from "@/features/ai/lib/read-job-ui-message-stream";
import { JobProgressTracker } from "@/features/ai/pipeline/server/job-progress-tracker";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("JobProgressTracker", () => {
	it("emits monotonic progress steps", async () => {
		const response = createJobResponse(({ writer }) => {
			const tracker = new JobProgressTracker(writer, {
				stageId: "connection-test",
			});
			tracker.step(10, "Validating...");
			tracker.step(5, "Should not regress");
			tracker.step(40, "Connecting...");
			tracker.step(150, "Should cap at 100");
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts.map((part) => part.data)).toEqual([
			{ step: "Validating...", percent: 10, stageId: "connection-test" },
			{ step: "Should not regress", percent: 10, stageId: "connection-test" },
			{ step: "Connecting...", percent: 40, stageId: "connection-test" },
			{ step: "Should cap at 100", percent: 100, stageId: "connection-test" },
		]);
	});

	it("throws when signal is aborted", () => {
		const controller = new AbortController();
		controller.abort();

		const response = createJobResponse(({ writer }) => {
			const tracker = new JobProgressTracker(writer, {
				signal: controller.signal,
				canceledMessage: "Connection test canceled",
			});

			expect(() => tracker.step(10, "Starting")).toThrow(
				"Connection test canceled",
			);
		});

		return consumeJobStreamFromResponse(response);
	});
});
