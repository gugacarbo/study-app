import { Store } from "@tanstack/store";

export interface ChatRuntimeStats {
	conversationId: string | null;
	runtimeMessageCount: number;
	contextCharacterCount: number;
	inputTokens: number | null;
	outputTokens: number | null;
	contextTokens: number | null;
	reasoningTokens: number | null;
	cachedInputTokens: number | null;
	totalTokens: number | null;
	sessionInputTokens: number | null;
	sessionOutputTokens: number | null;
	sessionTotalTokens: number | null;
	modelDisplayName: string | null;
	contextWindow: number | null;
	maxOutputTokens: number | null;
}

const INITIAL_STATE: ChatRuntimeStats = {
	conversationId: null,
	runtimeMessageCount: 0,
	contextCharacterCount: 0,
	inputTokens: null,
	outputTokens: null,
	contextTokens: null,
	reasoningTokens: null,
	cachedInputTokens: null,
	totalTokens: null,
	sessionInputTokens: null,
	sessionOutputTokens: null,
	sessionTotalTokens: null,
	modelDisplayName: null,
	contextWindow: null,
	maxOutputTokens: null,
};

const STORE_KEY = "__STUDY_APP_CHAT_RUNTIME_STATS_STORE__";

type ChatRuntimeStatsGlobal = typeof globalThis & {
	[STORE_KEY]?: Store<ChatRuntimeStats>;
};

export function getChatRuntimeStatsStore(): Store<ChatRuntimeStats> {
	const globalStore = globalThis as ChatRuntimeStatsGlobal;
	if (!globalStore[STORE_KEY]) {
		globalStore[STORE_KEY] = new Store<ChatRuntimeStats>(INITIAL_STATE);
	}
	return globalStore[STORE_KEY];
}

export function setChatRuntimeStats(
	stats: Partial<ChatRuntimeStats> & { conversationId: string },
): void {
	getChatRuntimeStatsStore().setState((state) => ({
		...state,
		...stats,
	}));
}

export function clearChatRuntimeStats(conversationId: string): void {
	getChatRuntimeStatsStore().setState((state) =>
		state.conversationId === conversationId ? INITIAL_STATE : state,
	);
}
