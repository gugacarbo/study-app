import type { UIMessage } from "@tanstack/ai-client";

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

export type IngestLogLevel = "info" | "warning" | "error";

export interface IngestLogEntry {
	id: string;
	timestamp: number;
	stageId: string | null;
	agentRunId: string | null;
	level: IngestLogLevel;
	message: string;
}

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
	questions: number;
	topics: string[];
}

export interface IngestJob {
	id: string;
	fileName: string;
	status: "queued" | "running" | "success" | "error" | "canceled";
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	stepText: string;
	logs: IngestLogEntry[];
	outputEntries: IngestOutputEntry[];
	agentRuns: IngestAgentRun[];
	tokenTotals: TokenTotals;
	nonAgentTokenTotals: TokenTotals;
	warnings: string[];
	result: IngestResultEvent | null;
	error: string | null;
	flowStages: FlowStage[];
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
