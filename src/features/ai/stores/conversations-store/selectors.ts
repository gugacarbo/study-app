import type { UIMessage } from "@tanstack/ai-client";
import type { AssistantPerfMetrics } from "@/features/ai/components/chat/message/chat-message-utils";
import { createConversation } from "./actions";
import type { ChatTokenTotals } from "./types";
import { conversationsStore, ensureWelcomeMessage } from "./types";

export function getConversationMessages(id: string): UIMessage[] {
	return ensureWelcomeMessage(conversationsStore.state.messagesMap[id] ?? []);
}

export function getTokenTotals(id: string): ChatTokenTotals {
	return (
		conversationsStore.state.tokenTotalsMap[id] ?? {
			inputTokens: 0,
			outputTokens: 0,
			contextTokens: 0,
		}
	);
}

export function getAssistantMetrics(
	id: string,
): Record<string, AssistantPerfMetrics> {
	return conversationsStore.state.metricsMap[id] ?? {};
}

export function ensureActiveConversation(): string {
	const { activeId, conversations } = conversationsStore.state;
	if (activeId && conversations.some((c) => c.id === activeId)) {
		return activeId;
	}
	return createConversation();
}
