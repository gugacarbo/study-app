import type { UIMessage } from "ai";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import {
	type AgentRunState,
	agentRunDataPartToReducerEvent,
	createSingleAgentRunState,
	reduceAgentEvent,
} from "./single-agent-run-reducer";

export interface MultiAgentRunState {
	runs: Map<string, AgentRunState>;
}

export function createMultiAgentRunState(): MultiAgentRunState {
	return { runs: new Map() };
}

export function getAgentRunState(
	state: MultiAgentRunState,
	agentRunId: string,
): AgentRunState | undefined {
	return state.runs.get(agentRunId);
}

function ensureRunForAgentPart(
	state: MultiAgentRunState,
	data: AgentRunDataPart,
): AgentRunState {
	const existing = state.runs.get(data.agentRunId);
	if (existing) return existing;

	if (
		data.eventType === "lifecycle" &&
		data.status === "pending" &&
		data.userPrompt
	) {
		return createSingleAgentRunState({
			agentRunId: data.agentRunId,
			label: data.label,
			systemPrompt: data.systemPrompt,
			userPrompt: data.userPrompt,
		});
	}

	return (
		existing ??
		createSingleAgentRunState({
			agentRunId: data.agentRunId,
			label: data.label,
			systemPrompt: data.systemPrompt,
			userPrompt: data.userPrompt,
		})
	);
}

export function applyAgentRunPartToMulti(
	state: MultiAgentRunState,
	data: AgentRunDataPart,
): MultiAgentRunState {
	const current = ensureRunForAgentPart(state, data);
	const reducerEvent = agentRunDataPartToReducerEvent(data);
	if (!reducerEvent) {
		if (current !== state.runs.get(data.agentRunId)) {
			const runs = new Map(state.runs);
			runs.set(data.agentRunId, current);
			return { runs };
		}
		return state;
	}

	const nextRun = reduceAgentEvent(current, reducerEvent);
	const runs = new Map(state.runs);
	runs.set(data.agentRunId, nextRun);
	return { runs };
}

export function rebuildMultiAgentMessages(
	state: MultiAgentRunState,
): UIMessage[] {
	const messages: UIMessage[] = [];
	for (const runState of state.runs.values()) {
		messages.push(...runState.messages);
	}
	return messages;
}
