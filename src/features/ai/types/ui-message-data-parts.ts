import type { InferUIMessageChunk, UIMessage } from "ai";
import type { PipelineLogLevel } from "@/features/ai/pipeline/types";

export type StageStatus =
	| "pending"
	| "running"
	| "done"
	| "warning"
	| "error"
	| "skipped";

export type AgentRunStatus =
	| "pending"
	| "running"
	| "done"
	| "warning"
	| "error"
	| "skipped";

type ToolEventState =
	| "awaiting-input"
	| "input-streaming"
	| "input-complete"
	| "approval-requested"
	| "approval-responded"
	| "streaming"
	| "complete"
	| "completed"
	| "error";

export type AgentRunEventType =
	| "lifecycle"
	| "result"
	| "warning"
	| "token"
	| "tool-call"
	| "tool-result";

/** `data-stage` — pipeline stage lifecycle (persistent). */
export interface StageDataPart {
	stageId: string;
	label: string;
	status: StageStatus;
	timestamp?: number;
	meta?: Record<string, unknown>;
}

/** `data-agent-run` — per-run lifecycle, tools, tokens (persistent). */
export interface AgentRunDataPart {
	agentRunId: string;
	stageId: string;
	label: string;
	eventType: AgentRunEventType;
	timestamp: number;
	status?: AgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?: unknown;
	state?: ToolEventState;
	name?: string;
	arguments?: string;
	input?: unknown;
	output?: unknown;
	content?: unknown;
	meta?: Record<string, unknown>;
}

/** `data-workspace-update` — improve-questions draft mutation (persistent). */
export interface WorkspaceUpdateDataPart {
	question: {
		id: string;
		question: string;
		options: string[];
		answers: string[];
		scoringMode?: string;
		explanation?: string | null;
		deepExplanation?: string;
		topic?: string;
		exam_id?: string;
	};
	updatedFields: string[];
}

/** `data-explanation-update` — explain-question draft mutation (persistent). */
export interface ExplanationUpdateDataPart {
	questionId: number;
	explanation: string;
	deepExplanation: string;
	updatedFields: Array<"explanation" | "deepExplanation">;
}

/** `data-job-progress` — step / percent updates (transient). */
export interface JobProgressDataPart {
	step?: string;
	percent?: number;
	stageId?: string;
	agentRunId?: string;
	meta?: Record<string, unknown>;
}

/** `data-job-result` — terminal success payload (persistent). */
export interface JobResultDataPart {
	[key: string]: unknown;
}

/** `data-job-error` — terminal failure (persistent). */
export interface JobErrorDataPart {
	message: string;
	stageId?: string;
	agentRunId?: string;
}

/** `data-process-log` — structured process timeline entry (persistent). */
export interface ProcessLogDataPart {
	level: PipelineLogLevel;
	message: string;
	stageId?: string;
	agentRunId?: string;
	timestamp?: number;
	data?: unknown;
}

export type StudyAppUIDataParts = {
	stage: StageDataPart;
	"agent-run": AgentRunDataPart;
	"workspace-update": WorkspaceUpdateDataPart;
	"explanation-update": ExplanationUpdateDataPart;
	"job-progress": JobProgressDataPart;
	"job-result": JobResultDataPart;
	"job-error": JobErrorDataPart;
	"process-log": ProcessLogDataPart;
};

export type StudyAppUIMessage = UIMessage<unknown, StudyAppUIDataParts>;

export type StudyAppUIMessageChunk = InferUIMessageChunk<StudyAppUIMessage>;

/** Data part keys that must be written with `transient: true`. */
export const TRANSIENT_UI_DATA_PARTS = new Set<keyof StudyAppUIDataParts>([
	"job-progress",
]);
