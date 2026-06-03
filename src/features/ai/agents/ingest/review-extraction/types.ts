import type { ExamIngestResponse } from "@/lib/validation";

export interface IngestReviewEvent {
	type: "step" | "warning";
	message: string;
}

type AgentRunStatus = "pending" | "running" | "done" | "error" | "skipped";
type AgentRunEventType = "lifecycle" | "result" | "warning" | "token";

export interface IngestReviewAgentEvent {
	eventType: AgentRunEventType;
	stageId: "review";
	agentRunId: string;
	label: string;
	status?: AgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?: unknown;
	meta?: Record<string, unknown>;
}

export interface IngestReviewResult {
	extracted: ExamIngestResponse;
	reviewed: boolean;
	reviewedQuestionCount: number;
	failedQuestionCount: number;
	reasons: string[];
}

export interface ReviewExtractionOptions {
	reviewTopics: string[];
	tools?: NonNullable<
		Parameters<typeof import("@/features/ai/core/generate").generateJson>[3]
	>["tools"];
	onEvent?: (event: IngestReviewEvent) => void;
	onAgentEvent?: (event: IngestReviewAgentEvent) => void;
	createAgentRunId?: (label: string) => string;
}
