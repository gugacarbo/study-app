import { mapWithConcurrency } from "@/features/ai/core/map-with-concurrency";
import type {
	ExplanationAgentRunEvent,
	RunQuestionExplanationsOptions,
} from "./types";

export { mapWithConcurrency };

export function emitAgentEvent(
	options: RunQuestionExplanationsOptions,
	event: ExplanationAgentRunEvent,
) {
	options.onAgentEvent?.(event);
}
