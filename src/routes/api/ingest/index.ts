import { createFileRoute } from "@tanstack/react-router";
import {
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeJobError,
	writeJobResult,
} from "@/features/ai/core/ui-message-job-stream";
import { ingestRequestSchema, runIngestWithProgress } from "./-pipeline";

export {
	buildExtractionUserPrompt,
	extractTextFromBytes,
} from "./-extract-text";
export { runExtractionPass } from "./-extraction-pass";
export { setupMemory } from "./-memory-refinement";
export { persistResults } from "./-persist";
export type { IngestRequest } from "./-pipeline";
export { ingestRequestSchema, runIngestWithProgress } from "./-pipeline";
export {
	parseCriticalTopics,
	summarizeSearchResultSnippets,
} from "./-review";
export { runReviewStage } from "./-review-stage";

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

				const stream = createJobUIMessageStream({
					execute: async ({ writer }) => {
						try {
							const result = await runIngestWithProgress(
								parsed.data,
								writer,
								request.signal,
							);
							writeJobResult(writer, result);
						} catch (error) {
							console.error(
								`[${new Date().toISOString()} ERROR ingest-handler] Ingest job failed:`,
								error,
								`fileName=${parsed.data.fileName}`,
							);
							writeJobError(writer, {
								message:
									error instanceof Error
										? error.message
										: "Unknown ingest error",
							});
						}
					},
				});

				return createJobUIMessageStreamResponse(stream);
			},
		},
	},
} as never);
