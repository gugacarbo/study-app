import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeProcessLog,
} from "@/features/ai/core/ui-message-job-stream";
import { consumeJobStreamFromResponse } from "@/features/ai/lib/read-job-ui-message-stream";
import type { StudyAppDataUIPart } from "@/features/ai/lib/read-job-ui-message-stream";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("writeProcessLog", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes a persistent data-process-log part with default timestamp", async () => {
		const fixedNow = 1_700_000_000_000;
		vi.spyOn(Date, "now").mockReturnValue(fixedNow);

		const response = createJobResponse(({ writer }) => {
			writeProcessLog(writer, {
				level: "info",
				message: "Running review...",
				stageId: "review",
				agentRunId: "review-1",
			});
		});

		const dataParts: StudyAppDataUIPart[] = [];
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
					timestamp: fixedNow,
				},
			}),
		]);
		expect(dataParts[0]).not.toHaveProperty("transient");
	});

	it("preserves an explicit timestamp and optional structured data", async () => {
		const response = createJobResponse(({ writer }) => {
			writeProcessLog(
				writer,
				{
					level: "warning",
					message: "Question 12 skipped after 3 attempts",
					timestamp: 42,
					data: { questionId: 12 },
				},
				{ id: "log-12" },
			);
		});

		const dataParts: StudyAppDataUIPart[] = [];
		await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts).toEqual([
			expect.objectContaining({
				type: "data-process-log",
				id: "log-12",
				data: {
					level: "warning",
					message: "Question 12 skipped after 3 attempts",
					timestamp: 42,
					data: { questionId: 12 },
				},
			}),
		]);
	});

	it("accumulates process-log parts in the assistant message", async () => {
		const response = createJobResponse(({ writer }) => {
			writeProcessLog(writer, {
				level: "info",
				message: "Stage started",
				timestamp: 1,
			});
			writeProcessLog(writer, {
				level: "error",
				message: "Stage failed",
				timestamp: 2,
			});
		});

		const result = await consumeJobStreamFromResponse(response);

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.parts.map((part) => part.type)).toEqual([
			"data-process-log",
			"data-process-log",
		]);
	});
});
