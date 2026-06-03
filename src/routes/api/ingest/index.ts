import { createFileRoute } from "@tanstack/react-router";
import { ingestRequestSchema, runIngestWithProgress } from "./pipeline";
import { formatSSE } from "./sse-emitter";

export {
	buildExtractionUserPrompt,
	extractTextFromBytes,
} from "./extract-text";
export { runExtractionPass } from "./extraction-pass";
export { setupMemory } from "./memory-refinement";
export { persistResults } from "./persist";
export type { IngestRequest } from "./pipeline";
export { ingestRequestSchema, runIngestWithProgress } from "./pipeline";
export {
	parseCriticalTopics,
	summarizeSearchResultSnippets,
} from "./review";
export { runReviewStage } from "./review-stage";
export type {
	AgentRunDescriptor,
	AgentRunEvent,
	AgentRunEventType,
	AgentRunStatus,
	StageStatus,
} from "./sse-emitter";
export {
	createAgentRunHelpers,
	formatSSE,
	isTextChunk,
	sendStage,
} from "./sse-emitter";

export const Route = createFileRoute("/api/ingest/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payloadRaw = await request.json().catch(() => null);
				const parsed = ingestRequestSchema.safeParse(payloadRaw);
				if (!parsed.success) {
					return new Response(
						JSON.stringify({
							error: "Invalid ingest payload",
							details: parsed.error.issues,
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const encoder = new TextEncoder();
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						const send = (event: string, data: unknown) => {
							controller.enqueue(encoder.encode(formatSSE(event, data)));
						};

						void (async () => {
							try {
								const result = await runIngestWithProgress(
									parsed.data,
									send,
									request.signal,
								);
								send("result", result);
							} catch (error) {
								console.error(
									`[${new Date().toISOString()} ERROR ingest-handler] Ingest job failed:`,
									error,
									`fileName=${parsed.data.fileName}`,
								);
								send("error", {
									message:
										error instanceof Error
											? error.message
											: "Unknown ingest error",
								});
							} finally {
								controller.close();
							}
						})();
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
					},
				});
			},
		},
	},
} as never);
