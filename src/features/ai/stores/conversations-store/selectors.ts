import type { UIMessage } from "ai";
import { createConversation } from "./actions";
import { loadConversationMessages } from "./sync";
import type { Conversation } from "./types";
import { conversationsStore } from "./types";

export function getConversationMessages(id: string): UIMessage[] {
	return conversationsStore.state.messagesMap[id] ?? [];
}

export interface GroupedConversations {
	currentPage: Conversation[];
	otherPages: Conversation[];
	general: Conversation[];
}

export function getConversationsForContext(
	conversations: Conversation[],
	contextKey: string,
): Conversation[] {
	return conversations.filter(
		(conversation) => conversation.contextKey === contextKey,
	);
}

export function getConversationsGrouped(
	conversations: Conversation[],
	currentContextKey: string,
): GroupedConversations {
	const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

	const currentPage: Conversation[] = [];
	const otherPages: Conversation[] = [];
	const general: Conversation[] = [];

	for (const conversation of sorted) {
		const key = conversation.contextKey;
		if (key === null) {
			general.push(conversation);
		} else if (key === currentContextKey) {
			currentPage.push(conversation);
		} else {
			otherPages.push(conversation);
		}
	}

	return { currentPage, otherPages, general };
}

export async function ensureActiveConversation(): Promise<string> {
	const { activeId, conversations } = conversationsStore.state;

	if (
		activeId &&
		conversations.some((conversation) => conversation.id === activeId)
	) {
		return activeId;
	}

	if (conversations.length > 0) {
		const id = conversations[0].id;
		conversationsStore.setState((state) => ({ ...state, activeId: id }));
		await loadConversationMessages(id);
		return id;
	}

	return await createConversation();
}
