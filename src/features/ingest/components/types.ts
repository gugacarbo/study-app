import type { UIMessage } from "ai";

export interface IngestTokenTotals {
	prompt: number;
	completion: number;
	total: number;
}

type IngestStageStatus =
	| "pending"
	| "running"
	| "done"
	| "warning"
	| "error"
	| "skipped";

export interface IngestPipelineStageViewModel {
	stageId: string;
	label: string;
	status: IngestStageStatus;
	timestamp: number;
	meta?: Record<string, unknown>;
}

interface IngestOutputMessageEntry {
	id: string;
	kind: "message";
	stageId?: string | null;
	role: "system" | "user" | "assistant";
	content: string;
	label?: string;
	status?: "default" | "warning" | "error" | "success";
}

interface IngestOutputEventEntry {
	id: string;
	kind: "event";
	stageId?: string | null;
	label: string;
	content?: string;
	tone?: "neutral" | "warning" | "error" | "success";
	data?: unknown;
}

export type IngestOutputEntry =
	| IngestOutputMessageEntry
	| IngestOutputEventEntry;

export interface IngestLogEntry {
	id: string;
	stageId?: string | null;
	timestamp?: number;
	level: "debug" | "info" | "warning" | "error";
	message: string;
	agentId?: string;
	data?: unknown;
}

export interface IngestAgentRunViewModel {
	id: string;
	stageId: string;
	name: string;
	state: "pending" | "running" | "success" | "warning" | "error";
	summary?: string;
	startedAt?: number;
	updatedAt?: number;
	finishedAt?: number;
	systemPrompt?: string;
	userPrompt?: string;
	response?: string;
	messages: UIMessage[];
	tokens?: Partial<IngestTokenTotals>;
	error?: string | null;
	raw?: {
		payload?: unknown;
		stream?: unknown;
		status?: unknown;
		tokens?: unknown;
		error?: unknown;
		meta?: Record<string, unknown>;
	};
}

export interface IngestJobViewModel {
	id: string;
	fileName: string;
	status: "queued" | "running" | "success" | "error" | "canceled";
	enableReview: boolean;
	enableExplanations: boolean;
	agentConcurrency: number;
	tokenTotals: IngestTokenTotals;
	outputEntries: IngestOutputEntry[];
	rawOutput: string;
	rawStreamText: string;
	logs: IngestLogEntry[];
	stages: IngestPipelineStageViewModel[];
	agents: IngestAgentRunViewModel[];
	error?: string | null;
}
