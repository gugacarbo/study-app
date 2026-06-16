import type { UIMessage } from "ai";
import {
	mergeMessagesForSave,
	trimMessagesForRuntime,
} from "@/lib/chat-conversations/trim";
import {
	type ChatConversationSummary,
	fromStoredMessages,
	type StoredChatMessage,
	toStoredMessages,
} from "@/lib/chat-conversations/types";
import {
	createChatConversation,
	deleteChatConversation,
	getChatConversation,
	listChatConversations,
	saveChatConversation,
} from "@/server-functions/chat-conversations";
import type { Conversation } from "./types";
import { conversationsStore } from "./types";

const SAVE_DEBOUNCE_MS = 500;

const fullMessagesCache = new Map<string, UIMessage[]>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function toClientConversation(summary: ChatConversationSummary): Conversation {
	return {
		id: summary.id,
		title: summary.title,
		messageCount: summary.messageCount,
		contextKey: summary.contextKey,
		createdAt: Date.parse(summary.createdAt) || Date.now(),
		updatedAt: Date.parse(summary.updatedAt) || Date.now(),
	};
}

export async function hydrateConversationsFromServer(): Promise<void> {
	conversationsStore.setState((state) => ({
		...state,
		isHydrating: true,
	}));

	try {
		const { conversations } = await listChatConversations();
		const mapped = conversations.map(toClientConversation);
		const activeId = mapped[0]?.id ?? null;

		conversationsStore.setState((state) => ({
			...state,
			conversations: mapped,
			activeId,
			isHydrated: true,
			isHydrating: false,
		}));

		if (activeId) {
			await loadConversationMessages(activeId);
		}
	} catch {
		conversationsStore.setState((state) => ({
			...state,
			isHydrated: true,
			isHydrating: false,
		}));
	}
}

export async function loadConversationMessages(id: string): Promise<void> {
	const existing = conversationsStore.state.messagesMap[id];
	if (existing && existing.length > 0) return;

	conversationsStore.setState((state) => ({
		...state,
		loadingConversationId: id,
	}));

	try {
		const result = (await getChatConversation({ data: { id } })) as {
			conversation: ChatConversationSummary;
			messages: StoredChatMessage[];
		};
		const messages = fromStoredMessages(result.messages);
		fullMessagesCache.set(id, messages);
		const runtimeMessages = trimMessagesForRuntime(messages);

		conversationsStore.setState((state) => ({
			...state,
			messagesMap: { ...state.messagesMap, [id]: runtimeMessages },
			conversations: state.conversations.map((item) =>
				item.id === id ? toClientConversation(result.conversation) : item,
			),
			loadingConversationId: null,
		}));
	} catch {
		conversationsStore.setState((state) => ({
			...state,
			loadingConversationId: null,
		}));
	}
}

async function persistConversation(id: string): Promise<void> {
	const state = conversationsStore.state;
	const conversation = state.conversations.find((item) => item.id === id);
	if (!conversation) return;

	const runtimeWindow = state.messagesMap[id] ?? [];
	const fullMessages = fullMessagesCache.get(id) ?? [];
	const merged = mergeMessagesForSave(fullMessages, runtimeWindow);

	try {
		const { conversation: saved } = await saveChatConversation({
			data: {
				id,
				title: conversation.title,
				messages: toStoredMessages(merged),
			},
		});

		fullMessagesCache.set(id, merged);
		conversationsStore.setState((current) => ({
			...current,
			conversations: current.conversations.map((item) =>
				item.id === id ? toClientConversation(saved) : item,
			),
		}));
	} catch {
		// persistence errors are non-fatal for the chat UI
	}
}

export function scheduleConversationSave(id: string): void {
	const existing = saveTimers.get(id);
	if (existing) clearTimeout(existing);

	saveTimers.set(
		id,
		setTimeout(() => {
			saveTimers.delete(id);
			void persistConversation(id);
		}, SAVE_DEBOUNCE_MS),
	);
}

export async function flushConversationSave(id: string): Promise<void> {
	const existing = saveTimers.get(id);
	if (existing) {
		clearTimeout(existing);
		saveTimers.delete(id);
	}
	await persistConversation(id);
}

export async function createConversationOnServer(
	title?: string,
	contextKey?: string | null,
): Promise<string> {
	const { conversation } = await createChatConversation({
		data: {
			...(title ? { title } : {}),
			...(contextKey !== undefined ? { contextKey } : {}),
		},
	});
	const clientConversation = toClientConversation(conversation);
	fullMessagesCache.set(clientConversation.id, []);

	conversationsStore.setState((state) => ({
		...state,
		conversations: [clientConversation, ...state.conversations],
		activeId: clientConversation.id,
		messagesMap: { ...state.messagesMap, [clientConversation.id]: [] },
	}));

	return clientConversation.id;
}

export async function deleteConversationOnServer(id: string): Promise<void> {
	const pending = saveTimers.get(id);
	if (pending) {
		clearTimeout(pending);
		saveTimers.delete(id);
	}

	await deleteChatConversation({ data: { id } });
	fullMessagesCache.delete(id);

	conversationsStore.setState((state) => {
		const conversations = state.conversations.filter((item) => item.id !== id);
		const { [id]: _removed, ...messagesMap } = state.messagesMap;
		return {
			...state,
			conversations,
			activeId:
				state.activeId === id ? (conversations[0]?.id ?? null) : state.activeId,
			messagesMap,
		};
	});

	const nextActiveId = conversationsStore.state.activeId;
	if (nextActiveId) {
		await loadConversationMessages(nextActiveId);
	}
}
