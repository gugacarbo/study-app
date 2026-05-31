import type { UIMessage } from "@tanstack/ai-client";
import { Store } from "@tanstack/store";
import type { AssistantPerfMetrics } from "@/features/ai/components/chat/message/chat-message-utils";

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

interface PersistedData {
	conversations: Conversation[];
	activeId: string | null;
	messagesMap: Record<string, UIMessage[]>;
	/** Per-conversation accumulated token totals (context-level) */
	tokenTotalsMap: Record<string, ChatTokenTotals>;
	/** Per-conversation, per-message performance metrics */
	metricsMap: Record<string, Record<string, AssistantPerfMetrics>>;
}

const STORAGE_KEY = "chat-conversations";

let idCounter = 0;
function generateId(): string {
	return `conv_${Date.now()}_${idCounter++}`;
}

function loadFromStorage(): PersistedData {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (parsed && typeof parsed === "object") {
				return {
					conversations: Array.isArray(parsed.conversations)
						? parsed.conversations
						: [],
					activeId:
						typeof parsed.activeId === "string" ? parsed.activeId : null,
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
	return {
		conversations: [],
		activeId: null,
		messagesMap: {},
		tokenTotalsMap: {},
		metricsMap: {},
	};
}

const WELCOME_MESSAGE: UIMessage = {
	id: "welcome",
	role: "assistant",
	parts: [
		{
			type: "text",
			content:
				"Hi! I'm your study assistant. Ask me anything about your subjects.",
		},
	],
};

function ensureWelcomeMessage(messages: UIMessage[]): UIMessage[] {
	if (messages.length === 0) {
		return [WELCOME_MESSAGE];
	}
	return messages;
}

const initial = loadFromStorage();

// Ensure active conversation exists if there are saved ones
if (initial.conversations.length > 0 && !initial.activeId) {
	initial.activeId = initial.conversations[0].id;
}

export const conversationsStore = new Store<PersistedData>(initial);

// Auto-persist on every change (debounced via microtask)
let persistTimer: ReturnType<typeof setTimeout> | null = null;
conversationsStore.subscribe(() => {
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

// --- Actions ---

export function createConversation(): string {
	const id = generateId();
	const now = Date.now();
	const conversation: Conversation = {
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

export function getConversationMessages(id: string): UIMessage[] {
	return ensureWelcomeMessage(conversationsStore.state.messagesMap[id] ?? []);
}

export function saveTokenTotals(id: string, totals: ChatTokenTotals) {
	conversationsStore.setState((s) => ({
		...s,
		tokenTotalsMap: { ...s.tokenTotalsMap, [id]: totals },
	}));
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

export function saveAssistantMetrics(
	id: string,
	metrics: Record<string, AssistantPerfMetrics>,
) {
	conversationsStore.setState((s) => ({
		...s,
		metricsMap: { ...s.metricsMap, [id]: metrics },
	}));
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
