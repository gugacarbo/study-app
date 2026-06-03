import type { UIMessage } from "@tanstack/ai-client";
import type { AssistantPerfMetrics } from "@/features/ai/components/chat/message/chat-message-utils";
import type { ChatTokenTotals } from "./types";
import { conversationsStore, generateId } from "./types";

export function createConversation(): string {
	const id = generateId();
	const now = Date.now();
	const conversation = {
		id,
		title: "New Chat",
		createdAt: now,
		updatedAt: now,
	};
	conversationsStore.setState((s) => ({
		...s,
		conversations: [conversation, ...s.conversations],
		activeId: id,
		messagesMap: { ...s.messagesMap, [id]: [] },
	}));
	return id;
}

export function deleteConversation(id: string) {
	conversationsStore.setState((s) => {
		const conversations = s.conversations.filter((c) => c.id !== id);
		const { [id]: _removed, ...messagesMap } = s.messagesMap;
		const { [id]: _removedTotals, ...tokenTotalsMap } = s.tokenTotalsMap;
		const { [id]: _removedMetrics, ...metricsMap } = s.metricsMap;
		return {
			...s,
			conversations,
			activeId: s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId,
			messagesMap,
			tokenTotalsMap,
			metricsMap,
		};
	});
}

export function setActiveConversation(id: string) {
	conversationsStore.setState((s) => ({ ...s, activeId: id }));
}

export function updateConversationTitle(id: string, title: string) {
	conversationsStore.setState((s) => ({
		...s,
		conversations: s.conversations.map((c) =>
			c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
		),
	}));
}

export function saveMessagesToConversation(id: string, messages: UIMessage[]) {
	conversationsStore.setState((s) => ({
		...s,
		messagesMap: { ...s.messagesMap, [id]: messages },
		conversations: s.conversations.map((c) =>
			c.id === id ? { ...c, updatedAt: Date.now() } : c,
		),
	}));
}

export function saveTokenTotals(id: string, totals: ChatTokenTotals) {
	conversationsStore.setState((s) => ({
		...s,
		tokenTotalsMap: { ...s.tokenTotalsMap, [id]: totals },
	}));
}

export function saveAssistantMetrics(
	id: string,
	metrics: Record<string, AssistantPerfMetrics>,
) {
	conversationsStore.setState((s) => ({
		...s,
		metricsMap: { ...s.metricsMap, [id]: metrics },
	}));
}
