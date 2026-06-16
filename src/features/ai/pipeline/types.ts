import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";

export type PipelineLogLevel = "debug" | "info" | "warning" | "error";

export interface PipelineLogEntry {
	id: string;
	timestamp: number;
	level: PipelineLogLevel;
	message: string;
	stageId?: string | null;
	agentRunId?: string | null;
	data?: unknown;
}

export type PipelineErrorSource =
	| "http"
	| "stream"
	| "job-error"
	| "agent-run"
	| "incomplete";

export interface PipelineErrorState {
	message: string;
	source: PipelineErrorSource;
	stageId?: string;
	agentRunId?: string;
	retryable: boolean;
}

export interface PipelineDiagnostics {
	error: PipelineErrorState | null;
	logs: PipelineLogEntry[];
	stepText: string;
}

export type AgentEventEmitter = (
	event: Omit<AgentRunDataPart, "timestamp">,
) => void;
