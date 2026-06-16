import { createFileRoute } from "@tanstack/react-router";
import { writeJobResult } from "@/features/ai/core/ui-message-job-stream";
import { createJobApiRoute } from "@/features/ai/pipeline/server/create-job-api-route";
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

const ingestHandler = createJobApiRoute({
	schema: ingestRequestSchema,
	logTag: "ingest-handler",
	signal: true,
	run: async ({ writer, data, signal, agentRuns, log, ctx }) => {
		const result = await runIngestWithProgress({
			payload: data,
			writer,
			abortSignal: signal ?? new AbortController().signal,
			agentRuns,
			log,
			ctx,
		});
		writeJobResult(writer, result);
	},
});

export const Route = createFileRoute("/api/ingest/")({
	server: {
		handlers: {
			POST: ingestHandler,
		},
	},
} as never);
