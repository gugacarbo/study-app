export type ConnectionProgressEvent = {
	progress: number;
	step: string;
};

export type ConnectionResultEvent = {
	response: string;
};

export type IngestResultEvent = {
	questions: number;
	topics: string[];
	examId: number;
	fileId: number;
};

export type IngestChunkEvent = {
	stageId?: string;
	agentRunId?: string;
	text: string;
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

export type IngestToolCallPart = {
	type: "tool-call";
	name?: string;
	arguments?: string;
	input?: unknown;
	output?: unknown;
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
};

export type IngestToolResultPart = {
	type: "tool-result";
	content?: unknown;
	error?: string;
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
