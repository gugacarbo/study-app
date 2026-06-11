import type { IngestAgentEvent } from "@/features/ingest/store/types";
import type { ExamIngestResponse } from "@/lib/validation";

export interface IngestReviewEvent {
	type: "step" | "warning";
	message: string;
}

export type IngestReviewAgentEvent = IngestAgentEvent & {
	stageId: "review";
};

export interface IngestReviewResult {
	extracted: ExamIngestResponse;
	reviewed: boolean;
	reviewedQuestionCount: number;
	failedQuestionCount: number;
	reasons: string[];
}

export interface ReviewExtractionOptions {
	reviewTopics: string[];
	concurrency?: number;
	tools?: NonNullable<
		Parameters<typeof import("@/features/ai/core/generate").generateJson>[3]
	>["tools"];
	onEvent?: (event: IngestReviewEvent) => void;
	onAgentEvent?: (event: IngestReviewAgentEvent) => void;
	createAgentRunId?: (label: string) => string;
}
