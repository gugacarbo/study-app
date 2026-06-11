import type { UIMessage } from "ai";
import { Store } from "@tanstack/store";
import type { AssistantPerfMetrics } from "@/features/ai/types/assistant-perf-metrics";

export interface Conversation {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

export interface ChatTokenTotals {
	inputTokens: number;
	outputTokens: number;
	contextTokens: number;
}

export interface PersistedData {
	conversations: Conversation[];
	activeId: string | null;
	messagesMap: Record<string, UIMessage[]>;
	tokenTotalsMap: Record<string, ChatTokenTotals>;
	metricsMap: Record<string, Record<string, AssistantPerfMetrics>>;
}

const STORAGE_KEY = "chat-conversations-v2";

let idCounter = 0;
function generateId(): string {
	return `conv_${Date.now()}_${idCounter++}`;
}

const EMPTY_PERSISTED_DATA: PersistedData = {
	conversations: [],
	activeId: null,
	messagesMap: {},
	tokenTotalsMap: {},
	metricsMap: {},
};

function loadFromStorage(): PersistedData {
	if (typeof window === "undefined") {
		return EMPTY_PERSISTED_DATA;
	}

	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (parsed && typeof parsed === "object") {
				const conversations = Array.isArray(parsed.conversations)
					? parsed.conversations
					: [];
				const activeId =
					typeof parsed.activeId === "string"
						? parsed.activeId
						: conversations.length > 0
							? conversations[0].id
							: null;

				return {
					conversations,
					activeId,
					messagesMap:
						parsed.messagesMap && typeof parsed.messagesMap === "object"
							? parsed.messagesMap
							: {},
					tokenTotalsMap:
						parsed.tokenTotalsMap && typeof parsed.tokenTotalsMap === "object"
							? parsed.tokenTotalsMap
							: {},
					metricsMap:
						parsed.metricsMap && typeof parsed.metricsMap === "object"
							? parsed.metricsMap
							: {},
				};
			}
		}
	} catch {
		// corrupt data
	}
	return EMPTY_PERSISTED_DATA;
}

export function hydrateConversationsFromStorage() {
	if (typeof window === "undefined") return;
	conversationsStore.setState(() => loadFromStorage());
}

export const conversationsStore = new Store<PersistedData>(
	EMPTY_PERSISTED_DATA,
);

let persistTimer: ReturnType<typeof setTimeout> | null = null;
conversationsStore.subscribe(() => {
	if (typeof window === "undefined") return;
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		try {
			const {
				conversations,
				activeId,
				messagesMap,
				tokenTotalsMap,
				metricsMap,
			} = conversationsStore.state;
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					conversations,
					activeId,
					messagesMap,
					tokenTotalsMap,
					metricsMap,
				}),
			);
		} catch {
			// localStorage full or unavailable
		}
	}, 0);
});

export { generateId };
