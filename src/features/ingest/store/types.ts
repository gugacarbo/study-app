import type { UIMessage } from "ai";

export interface TokenTotals {
	prompt: number;
	completion: number;
	total: number;
}

export function createEmptyTotals(): TokenTotals {
	return { prompt: 0, completion: 0, total: 0 };
}

export interface FlowStage {
	stageId: string;
	label: string;
	status: "pending" | "running" | "done" | "warning" | "error" | "skipped";
	timestamp: number;
	meta?: Record<string, unknown>;
}

import type { PipelineLogEntry } from "@/features/ai/pipeline/types";

export type { PipelineLogEntry };

export interface IngestOutputEntry {
	id: string;
	timestamp: number;
	stageId: string | null;
	agentRunId: string | null;
	kind: "chunk" | "warning";
	text: string;
}

export type IngestAgentStatus =
	| "pending"
	| "running"
	| "done"
	| "warning"
	| "error"
	| "skipped";

export interface IngestAgentRun {
	id: string;
	stageId: string;
	label: string;
	status: IngestAgentStatus;
	timestamp: number;
	systemPrompt: string;
	userPrompt: string;
	messages: UIMessage[];
	outputText: string;
	rawOutput: unknown;
	error: string | null;
	warnings: string[];
	tokenTotals: TokenTotals;
	meta?: Record<string, unknown>;
}

export interface IngestResultEvent {
	examId?: number;
	fileId?: number;
	questions: number;
	topics: string[];
}

export type IngestChunkEvent = {
	stageId?: string;
	agentRunId?: string;
	text: string;
	kind?: "text" | "reasoning";
	timestamp?: number;
};

export type IngestTokenEvent = {
	prompt: number;
	completion: number;
	total: number;
	stageId?: string;
	agentRunId?: string;
	timestamp?: number;
};

export type IngestWarningEvent = {
	message: string;
	stageId?: string;
	agentRunId?: string;
	timestamp?: number;
};

export type IngestStageEvent = {
	stageId: string;
	label: string;
	status: string;
	timestamp: number;
	meta?: Record<string, unknown>;
};

export type IngestAgentEvent = {
	eventType?:
		| "lifecycle"
		| "result"
		| "warning"
		| "token"
		| "tool-call"
		| "tool-result";
	agentRunId: string;
	stageId: string;
	label: string;
	status?: string;
	state?:
		| "awaiting-input"
		| "input-streaming"
		| "input-complete"
		| "approval-requested"
		| "approval-responded"
		| "streaming"
		| "complete"
		| "completed"
		| "error";
	timestamp?: number;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?:
		| {
				prompt?: number;
				completion?: number;
				total?: number;
		  }
		| unknown;
	meta?: Record<string, unknown>;
	name?: string;
	arguments?: string;
	input?: unknown;
	output?: unknown;
	content?: unknown;
};

export interface IngestJob {
	id: string;
	fileName: string;
	status: "queued" | "running" | "success" | "error" | "canceled";
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	stepText: string;
	logs: PipelineLogEntry[];
	outputEntries: IngestOutputEntry[];
	agentRuns: IngestAgentRun[];
	tokenTotals: TokenTotals;
	nonAgentTokenTotals: TokenTotals;
	warnings: string[];
	result: IngestResultEvent | null;
	error: string | null;
	stages: FlowStage[];
	buffer: number[];
	enableReview: boolean;
	enableExplanations: boolean;
	agentConcurrency: number;
	rawStreamText: string;
}

export interface IngestStoreState {
	jobs: IngestJob[];
	focusedJobId: string | null;
}

export interface PersistedIngestJob extends Omit<IngestJob, "buffer"> {
	buffer?: number[];
}

export interface PersistedIngestStoreState {
	jobs: PersistedIngestJob[];
	focusedJobId: string | null;
}

export const INGEST_STORAGE_KEY = "ingest-jobs";
