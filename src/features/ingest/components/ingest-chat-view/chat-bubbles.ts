import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "../types";

export interface ChatBubble {
	id: string;
	agentRunId: string;
	agentName: string;
	agentState: IngestAgentRunViewModel["state"];
	stageId: string;
	role: "system" | "user" | "assistant";
	content: string;
	isStreaming: boolean;
}

export function buildChatBubbles(
	agents: IngestAgentRunViewModel[],
	stages: IngestPipelineStageViewModel[],
): ChatBubble[] {
	const bubbles: ChatBubble[] = [];
	const stageOrder = new Map<string, number>();
	for (const stage of stages) {
		stageOrder.set(stage.stageId, stageOrder.size);
	}

	const sortedAgents = [...agents].sort((a, b) => {
		const aOrder = stageOrder.get(a.stageId) ?? 0;
		const bOrder = stageOrder.get(b.stageId) ?? 0;
		if (aOrder !== bOrder) return aOrder - bOrder;
		return (a.startedAt ?? 0) - (b.startedAt ?? 0);
	});

	for (const agent of sortedAgents) {
		const isStreaming = agent.state === "running";

		if (agent.systemPrompt) {
			bubbles.push({
				id: `${agent.id}-system`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "system",
				content: agent.systemPrompt,
				isStreaming: false,
			});
		}
		if (agent.userPrompt) {
			bubbles.push({
				id: `${agent.id}-user`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "user",
				content: agent.userPrompt,
				isStreaming: false,
			});
		}
		if (agent.response || isStreaming) {
			bubbles.push({
				id: `${agent.id}-assistant`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "assistant",
				content: agent.response ?? "",
				isStreaming,
			});
		}
		if (agent.error) {
			bubbles.push({
				id: `${agent.id}-error`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "system",
				content: agent.error,
				isStreaming: false,
			});
		}
	}

	return bubbles;
}
