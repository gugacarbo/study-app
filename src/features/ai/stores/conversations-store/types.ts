import { Store } from "@tanstack/store";
import type { UIMessage } from "ai";

export interface Conversation {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
}

export interface ConversationsState {
	conversations: Conversation[];
	activeId: string | null;
	messagesMap: Record<string, UIMessage[]>;
	isHydrated: boolean;
	isHydrating: boolean;
	loadingConversationId: string | null;
}

const INITIAL_STATE: ConversationsState = {
	conversations: [],
	activeId: null,
	messagesMap: {},
	isHydrated: false,
	isHydrating: false,
	loadingConversationId: null,
};

export const conversationsStore = new Store<ConversationsState>(INITIAL_STATE);
