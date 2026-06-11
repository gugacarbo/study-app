import type { UIMessage } from "ai";
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
	message: UIMessage;
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
		const messages = getAgentMessages(agent, isStreaming);

		for (const message of messages) {
			bubbles.push({
				id: message.id,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				message,
				isStreaming: isStreaming && message.role === "assistant",
			});
		}
	}

	return bubbles;
}

function getAgentMessages(
	agent: IngestAgentRunViewModel,
	isStreaming: boolean,
): UIMessage[] {
	if (agent.messages?.length) {
		return agent.messages as unknown as UIMessage[];
	}

	const messages: UIMessage[] = [];

	const systemMessage = createTextMessage(
		`${agent.id}-system`,
		"system",
		agent.systemPrompt,
	);
	if (systemMessage) {
		messages.push(systemMessage);
	}

	const userMessage = createTextMessage(
		`${agent.id}-user`,
		"user",
		agent.userPrompt,
	);
	if (userMessage) {
		messages.push(userMessage);
	}

	const assistantMessage = createTextMessage(
		`${agent.id}-assistant`,
		"assistant",
		agent.response ?? (isStreaming ? "" : undefined),
	);
	if (assistantMessage) {
		messages.push(assistantMessage);
	}

	const errorMessage = createTextMessage(
		`${agent.id}-error`,
		"system",
		agent.error ?? undefined,
	);
	if (errorMessage) {
		messages.push(errorMessage);
	}

	return messages;
}

function createTextMessage(
	id: string,
	role: UIMessage["role"],
	content?: string,
): UIMessage | null {
	if (content == null) return null;

	return {
		id,
		role,
		parts: [{ type: "text", text: content }],
	};
}
