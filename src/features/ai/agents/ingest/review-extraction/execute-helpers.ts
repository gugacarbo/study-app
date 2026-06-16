import { mapWithConcurrency } from "@/features/ai/core/map-with-concurrency";
import type { IngestReviewAgentEvent, ReviewExtractionOptions } from "./types";

export { mapWithConcurrency };

export function emitAgentEvent(
	options: ReviewExtractionOptions,
	event: IngestReviewAgentEvent,
) {
	options.onAgentEvent?.(event);
}
