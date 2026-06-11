import type { UIMessage } from "ai";
import { createConversation } from "./actions";
import { loadConversationMessages } from "./sync";
import { conversationsStore } from "./types";

export function getConversationMessages(id: string): UIMessage[] {
	return conversationsStore.state.messagesMap[id] ?? [];
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
