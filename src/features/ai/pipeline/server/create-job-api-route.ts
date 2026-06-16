import type { z } from "zod";
import {
	createAgentRunWriter,
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeJobError,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { createPipelineLogger, type PipelineLogger } from "./pipeline-logger";

export interface PipelineRunContext {
	stageId?: string;
	agentRunId?: string;
}

export interface JobApiRouteRunContext<TData> {
	writer: JobUIMessageStreamWriter;
	data: TData;
	signal?: AbortSignal;
	agentRuns: ReturnType<typeof createAgentRunWriter>;
	log: PipelineLogger;
	ctx: PipelineRunContext;
	preflightResult?: unknown;
}

export interface CreateJobApiRouteOptions<TSchema extends z.ZodType> {
	schema: TSchema;
	logTag: string;
	signal?: boolean;
	preflight?: (
		data: z.infer<TSchema>,
	) => Promise<unknown> | unknown;
	run: (context: JobApiRouteRunContext<z.infer<TSchema>>) => Promise<void> | void;
}

function normalizeErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

export function createJobApiRoute<TSchema extends z.ZodType>(
	options: CreateJobApiRouteOptions<TSchema>,
) {
	const { schema, logTag, signal: passSignal, preflight, run } = options;

	return async ({ request }: { request: Request }) => {
		const payloadRaw = await request.json().catch(() => null);
		const parsed = schema.safeParse(payloadRaw);
		if (!parsed.success) {
			return new Response(
				JSON.stringify({
					error: `Invalid ${logTag} payload`,
					details: parsed.error.issues,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		let preflightResult: unknown;
		if (preflight) {
			try {
				preflightResult = await preflight(parsed.data);
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: normalizeErrorMessage(error),
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		const pipelineCtx: PipelineRunContext = {};
		const abortSignal = passSignal ? request.signal : undefined;

		const stream = createJobUIMessageStream({
			execute: async ({ writer }) => {
				const agentRuns = createAgentRunWriter(writer);
				const log = createPipelineLogger(writer, {});

				try {
					await run({
						writer,
						data: parsed.data,
						signal: abortSignal,
						agentRuns,
						log,
						ctx: pipelineCtx,
						preflightResult,
					});
				} catch (error) {
					console.error(
						`[${new Date().toISOString()} ERROR ${logTag}] Job failed:`,
						error,
					);
					const message = normalizeErrorMessage(error);
					log.error(message, {
						stageId: pipelineCtx.stageId,
						agentRunId: pipelineCtx.agentRunId,
					});
					writeJobError(writer, {
						message,
						stageId: pipelineCtx.stageId,
						agentRunId: pipelineCtx.agentRunId,
					});
				}
			},
		});

		return createJobUIMessageStreamResponse(stream);
	};
}
