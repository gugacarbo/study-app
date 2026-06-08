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
	| "error"
	| "skipped";
export type ToolEventState =
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

export interface AgentRunDescriptor {
	stageId: string;
	agentRunId: string;
	label: string;
}
export interface AgentRunEvent {
	eventType: AgentRunEventType;
	stageId: string;
	agentRunId: string;
	label: string;
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

export function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function isTextChunk(
	chunk: unknown,
): chunk is { type: "TEXT_MESSAGE_CONTENT"; delta: string } {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "TEXT_MESSAGE_CONTENT" &&
		"delta" in chunk &&
		typeof chunk.delta === "string"
	);
}

export function sendStage(
	send: (event: string, data: unknown) => void,
	stageId: string,
	label: string,
	status: StageStatus,
	meta?: Record<string, unknown>,
) {
	send("stage", { stageId, label, status, timestamp: Date.now(), meta });
}

export function createAgentRunHelpers(
	send: (event: string, data: unknown) => void,
) {
	let runCounter = 0;

	const sendAgentRun = (event: Omit<AgentRunEvent, "timestamp">) => {
		send("agent", { ...event, timestamp: Date.now() });
	};

	return {
		createRun(stageId: string, label: string): AgentRunDescriptor {
			runCounter += 1;
			return { stageId, label, agentRunId: `${stageId}-${runCounter}` };
		},
		lifecycle(
			run: AgentRunDescriptor,
			status: AgentRunStatus,
			meta?: Omit<
				AgentRunEvent,
				| "eventType"
				| "stageId"
				| "agentRunId"
				| "label"
				| "timestamp"
				| "status"
			>,
		) {
			sendAgentRun({
				eventType: "lifecycle",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				status,
				...meta,
			});
		},
		result(
			run: AgentRunDescriptor,
			finalObject: unknown,
			rawText?: string,
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "result",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				finalObject,
				rawText,
				meta,
			});
		},
		warning(
			run: AgentRunDescriptor,
			warning: string,
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "warning",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				warning,
				meta,
			});
		},
		token(
			run: AgentRunDescriptor,
			tokens: unknown,
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "token",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				tokens,
				meta,
			});
		},
		toolCall(
			run: AgentRunDescriptor,
			tool: {
				name?: string;
				arguments?: string;
				input?: unknown;
				output?: unknown;
				state?: ToolEventState;
			},
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "tool-call",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				...tool,
				meta,
			});
		},
		toolResult(
			run: AgentRunDescriptor,
			result: {
				content?: unknown;
				error?: string;
				state?: ToolEventState;
			},
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "tool-result",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				...result,
				meta,
			});
		},
	};
}
