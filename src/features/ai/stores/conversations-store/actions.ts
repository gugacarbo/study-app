import type { UIMessage } from "ai";
import {
	createConversationOnServer,
	deleteConversationOnServer,
	loadConversationMessages,
	scheduleConversationSave,
} from "./sync";
import { conversationsStore } from "./types";

export async function createConversation(contextKey?: string | null): Promise<string> {
	return await createConversationOnServer(undefined, contextKey);
}

export async function deleteConversation(id: string): Promise<void> {
	await deleteConversationOnServer(id);
}

export async function setActiveConversation(id: string): Promise<void> {
	conversationsStore.setState((state) => ({ ...state, activeId: id }));
	await loadConversationMessages(id);
}

export function updateConversationTitle(id: string, title: string) {
	conversationsStore.setState((state) => ({
		...state,
		conversations: state.conversations.map((conversation) =>
			conversation.id === id
				? { ...conversation, title, updatedAt: Date.now() }
				: conversation,
		),
	}));
	scheduleConversationSave(id);
}

export function saveMessagesToConversation(id: string, messages: UIMessage[]) {
	conversationsStore.setState((state) => ({
		...state,
		messagesMap: { ...state.messagesMap, [id]: messages },
		conversations: state.conversations.map((conversation) =>
			conversation.id === id
				? { ...conversation, updatedAt: Date.now() }
				: conversation,
		),
	}));
	scheduleConversationSave(id);
}
