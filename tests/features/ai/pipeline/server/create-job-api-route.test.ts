import { describe, expect, it } from "vitest";
import { z } from "zod";
import { writeJobResult } from "@/features/ai/core/ui-message-job-stream";
import { consumeJobStreamFromResponse } from "@/features/ai/lib/read-job-ui-message-stream";
import { createJobApiRoute } from "@/features/ai/pipeline/server/create-job-api-route";

describe("createJobApiRoute", () => {
	it("returns 400 JSON for invalid payload", async () => {
		const handler = createJobApiRoute({
			schema: z.object({ value: z.number() }),
			logTag: "test-job",
			run: async () => {},
		});

		const response = await handler({
			request: new Request("http://localhost/api/test", {
				method: "POST",
				body: JSON.stringify({ value: "nope" }),
				headers: { "Content-Type": "application/json" },
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual(
			expect.objectContaining({
				error: "Invalid test-job payload",
				details: expect.any(Array),
			}),
		);
	});

	it("returns 500 JSON when preflight fails", async () => {
		const handler = createJobApiRoute({
			schema: z.object({ value: z.number() }),
			logTag: "test-job",
			preflight: async () => {
				throw new Error("Model not configured");
			},
			run: async () => {},
		});

		const response = await handler({
			request: new Request("http://localhost/api/test", {
				method: "POST",
				body: JSON.stringify({ value: 1 }),
				headers: { "Content-Type": "application/json" },
			}),
		});

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Model not configured",
		});
	});

	it("streams job result on success", async () => {
		const handler = createJobApiRoute({
			schema: z.object({ value: z.number() }),
			logTag: "test-job",
			preflight: async (data) => ({ doubled: data.value * 2 }),
			run: async ({ writer, data, preflightResult, agentRuns, log }) => {
				const run = agentRuns.createRun("test", "Test Agent");
				log.info(`Running with ${data.value}`);
				agentRuns.lifecycle(run, "done");
				writeJobResult(writer, {
					value: data.value,
					preflight: preflightResult,
				});
			},
		});

		const response = await handler({
			request: new Request("http://localhost/api/test", {
				method: "POST",
				body: JSON.stringify({ value: 3 }),
				headers: { "Content-Type": "application/json" },
			}),
		});

		const result = await consumeJobStreamFromResponse(response);
		const resultPart = result.messages[0]?.parts.find(
			(part) => part.type === "data-job-result",
		);

		expect(resultPart).toEqual(
			expect.objectContaining({
				type: "data-job-result",
				data: { value: 3, preflight: { doubled: 6 } },
			}),
		);
	});

	it("writes job-error and process log when run throws", async () => {
		const handler = createJobApiRoute({
			schema: z.object({ value: z.number() }),
			logTag: "test-job",
			run: async ({ ctx }) => {
				ctx.stageId = "test-stage";
				ctx.agentRunId = "test-1";
				throw new Error("Stage exploded");
			},
		});

		const response = await handler({
			request: new Request("http://localhost/api/test", {
				method: "POST",
				body: JSON.stringify({ value: 1 }),
				headers: { "Content-Type": "application/json" },
			}),
		});

		const dataParts: Array<{ type: string; data: unknown }> = [];
		await expect(
			consumeJobStreamFromResponse(response, {
				onData: (part) => dataParts.push(part),
			}),
		).rejects.toThrow("Stage exploded");

		expect(dataParts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-process-log",
					data: expect.objectContaining({
						level: "error",
						message: "Stage exploded",
					}),
				}),
				expect.objectContaining({
					type: "data-job-error",
					data: {
						message: "Stage exploded",
						stageId: "test-stage",
						agentRunId: "test-1",
					},
				}),
			]),
		);
	});

	it("passes request.signal when signal option is enabled", async () => {
		const handler = createJobApiRoute({
			schema: z.object({ value: z.number() }),
			logTag: "test-job",
			signal: true,
			run: async ({ signal, writer }) => {
				writeJobResult(writer, { aborted: signal?.aborted ?? false });
			},
		});

		const controller = new AbortController();
		const response = await handler({
			request: new Request("http://localhost/api/test", {
				method: "POST",
				body: JSON.stringify({ value: 1 }),
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
			}),
		});

		const result = await consumeJobStreamFromResponse(response);
		const resultPart = result.messages[0]?.parts.find(
			(part) => part.type === "data-job-result",
		);

		expect(resultPart).toEqual(
			expect.objectContaining({
				data: { aborted: false },
			}),
		);
	});
});
