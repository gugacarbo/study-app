import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeAgentRun,
	writeJobError,
	writeJobProgress,
	writeJobResult,
	writeStage,
} from "@/features/ai/core/ui-message-job-stream";
import type { StudyAppDataUIPart } from "@/features/ai/lib/read-job-ui-message-stream";
import {
	consumeJobStream,
	consumeJobStreamFromResponse,
} from "@/features/ai/lib/read-job-ui-message-stream";

function createJobResponse(
	execute: Parameters<typeof createJobUIMessageStream>[0]["execute"],
): Response {
	const stream = createJobUIMessageStream({ execute });
	return createJobUIMessageStreamResponse(stream);
}

describe("consumeJobStreamFromResponse", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("dispatches onData for persistent and transient data parts and accumulates messages", async () => {
		const response = createJobResponse(({ writer }) => {
			writeStage(writer, {
				stageId: "extract",
				label: "Extract",
				status: "running",
			});
			writeJobProgress(writer, { step: "Parsing PDF", percent: 10 });
			writeAgentRun(writer, {
				agentRunId: "extract-1",
				stageId: "extract",
				label: "Extractor",
				eventType: "lifecycle",
				status: "running",
				timestamp: 1,
			});
			writeJobResult(writer, { questions: 1, topics: ["math"] });
		});

		const dataParts: StudyAppDataUIPart[] = [];
		const result = await consumeJobStreamFromResponse(response, {
			onData: (part) => dataParts.push(part),
		});

		expect(dataParts.map((part) => part.type)).toEqual([
			"data-stage",
			"data-job-progress",
			"data-agent-run",
			"data-job-result",
		]);
		expect(dataParts[0]).toMatchObject({
			type: "data-stage",
			data: {
				stageId: "extract",
				label: "Extract",
				status: "running",
			},
		});
		expect(dataParts[1]).toMatchObject({
			type: "data-job-progress",
			data: { step: "Parsing PDF", percent: 10 },
		});

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0]?.role).toBe("assistant");
		expect(result.messages[0]?.parts.map((part) => part.type)).toEqual([
			"data-stage",
			"data-agent-run",
			"data-job-result",
		]);
	});

	it("throws after dispatching onData when the stream emits data-job-error", async () => {
		const response = createJobResponse(({ writer }) => {
			writeJobError(writer, { message: "Ingest failed", stageId: "extract" });
		});

		const dataParts: StudyAppDataUIPart[] = [];
		await expect(
			consumeJobStreamFromResponse(response, {
				onData: (part) => dataParts.push(part),
			}),
		).rejects.toThrow("Ingest failed");

		expect(dataParts).toEqual([
			expect.objectContaining({
				type: "data-job-error",
				data: { message: "Ingest failed", stageId: "extract" },
			}),
		]);
	});

	it("throws when the HTTP response is not ok", async () => {
		const response = new Response("bad request", { status: 400 });
		await expect(consumeJobStreamFromResponse(response)).rejects.toThrow(
			"bad request",
		);
	});
});

describe("consumeJobStream", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches the endpoint and consumes the UI message stream", async () => {
		const response = createJobResponse(({ writer }) => {
			writeJobResult(writer, { ok: true });
		});

		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(response.clone());

		const result = await consumeJobStream({
			url: "/api/test-connection",
			init: {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ping: true }),
			},
		});

		expect(fetchMock).toHaveBeenCalledWith("/api/test-connection", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ping: true }),
			signal: undefined,
		});
		expect(result.messages[0]?.parts).toEqual([
			expect.objectContaining({
				type: "data-job-result",
				data: { ok: true },
			}),
		]);
	});
});
