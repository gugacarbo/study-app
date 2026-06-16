import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunStatus } from "@/features/ai/types/ui-message-data-parts";

export interface BridgeAgentRunEventWriter {
	lifecycle(
		run: AgentRunDescriptor,
		status: AgentRunStatus,
		meta?: Record<string, unknown>,
	): void;
	warning(
		run: AgentRunDescriptor,
		warning: string,
		meta?: Record<string, unknown>,
	): void;
	result(
		run: AgentRunDescriptor,
		finalObject: unknown,
		rawText?: string,
		meta?: Record<string, unknown>,
	): void;
	token(
		run: AgentRunDescriptor,
		tokens: unknown,
		meta?: Record<string, unknown>,
	): void;
	textDelta(run: AgentRunDescriptor, delta: string): void;
	reasoningDelta(run: AgentRunDescriptor, delta: string): void;
	toolCall(
		run: AgentRunDescriptor,
		tool: {
			name?: string;
			arguments?: string;
			input?: unknown;
			output?: unknown;
			state?: string;
		},
		meta?: Record<string, unknown>,
	): void;
	toolResult(
		run: AgentRunDescriptor,
		result: {
			content?: unknown;
			error?: string;
			state?: string;
		},
		meta?: Record<string, unknown>,
	): void;
}

export interface BridgeAgentRunEvent {
	eventType?:
		| "lifecycle"
		| "result"
		| "warning"
		| "token"
		| "tool-call"
		| "tool-result";
	stageId: string;
	agentRunId: string;
	label: string;
	status?: string;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?: unknown;
	meta?: Record<string, unknown>;
	name?: string;
	arguments?: string;
	input?: unknown;
	output?: unknown;
	state?: string;
	content?: unknown;
}

export function normalizeAgentStatus(status?: string): AgentRunStatus {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}

export function bridgeAgentRunEvent(
	event: BridgeAgentRunEvent,
	agentRuns: BridgeAgentRunEventWriter,
	onWarning?: (message: string, meta?: Record<string, unknown>) => void,
) {
	const run = {
		stageId: event.stageId,
		agentRunId: event.agentRunId,
		label: event.label,
	};
	const meta = event.meta;

	if (event.eventType === "lifecycle") {
		agentRuns.lifecycle(run, normalizeAgentStatus(event.status), {
			systemPrompt: event.systemPrompt,
			userPrompt: event.userPrompt,
			rawText: event.rawText,
			finalObject: event.finalObject,
			error: event.error,
			warning: event.warning,
			meta,
		});
		return;
	}

	if (event.eventType === "warning" && event.warning) {
		onWarning?.(event.warning, {
			stageId: event.stageId,
			agentRunId: event.agentRunId,
		});
		agentRuns.warning(run, event.warning, meta);
		return;
	}

	if (event.eventType === "result") {
		agentRuns.result(run, event.finalObject, event.rawText, meta);
		return;
	}

	if (event.eventType === "token") {
		if (typeof event.rawText === "string" && event.rawText.length > 0) {
			if (meta?.kind === "reasoning") {
				agentRuns.reasoningDelta(run, event.rawText);
			} else {
				agentRuns.textDelta(run, event.rawText);
			}
			return;
		}

		if (event.tokens) {
			agentRuns.token(run, event.tokens, meta);
		}
		return;
	}

	if (event.eventType === "tool-call") {
		agentRuns.toolCall(
			run,
			{
				name: event.name,
				arguments: event.arguments,
				input: event.input,
				output: event.output,
				state: event.state,
			},
			meta,
		);
		return;
	}

	if (event.eventType === "tool-result") {
		agentRuns.toolResult(
			run,
			{
				content: event.content,
				error: event.error,
				state: event.state,
			},
			meta,
		);
	}
}
