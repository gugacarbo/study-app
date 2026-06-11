import type {
	GenericThreadHistoryAdapter,
	MessageFormatAdapter,
	MessageFormatItem,
	ThreadHistoryAdapter,
} from "@assistant-ui/core";
import type { UIMessage } from "ai";
import { saveMessagesToConversation } from "./actions";
import { getConversationMessages } from "./selectors";
import { conversationsStore } from "./types";

function toMessageRepository<TMessage>(
	messages: TMessage[],
	getId: (message: TMessage) => string,
): MessageFormatItem<TMessage>[] {
	return messages.map((message, index) => ({
		parentId:
			index === 0 ? null : getId(messages[index - 1] as TMessage),
		message,
	}));
}

export function createConversationHistoryAdapter(
	getConversationId: () => string | null,
): ThreadHistoryAdapter {
	return {
		async load() {
			return { headId: null, messages: [] };
		},
		async append() {},

		withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
			fmt: MessageFormatAdapter<TMessage, TStorageFormat>,
		): GenericThreadHistoryAdapter<TMessage> {
			return {
				async load() {
					const conversationId = getConversationId();
					if (!conversationId) return { messages: [] };

					const stored = getConversationMessages(conversationId).filter(
						(message) => message.id !== "welcome",
					) as unknown as TMessage[];
					if (stored.length === 0) return { messages: [] };

					const lastMessage = stored.at(-1);
					if (!lastMessage) return { messages: [] };

					return {
						headId: fmt.getId(lastMessage),
						messages: toMessageRepository(stored, fmt.getId),
					};
				},

				async append(item: MessageFormatItem<TMessage>) {
					const conversationId = getConversationId();
					if (!conversationId) return;

					const messageId = fmt.getId(item.message);
					const existing = (
						conversationsStore.state.messagesMap[conversationId] ?? []
					).filter((message) => message.id !== "welcome");

					const index = existing.findIndex((message) => message.id === messageId);
					const updated =
						index >= 0
							? existing.map((message, i) =>
									i === index
										? (item.message as unknown as UIMessage)
										: message,
								)
							: [
									...existing,
									item.message as unknown as UIMessage,
								];

					saveMessagesToConversation(conversationId, updated);
				},

				async update(
					item: MessageFormatItem<TMessage>,
					localMessageId: string,
				) {
					const conversationId = getConversationId();
					if (!conversationId) return;

					const existing = (
						conversationsStore.state.messagesMap[conversationId] ?? []
					).filter((message) => message.id !== "welcome");

					const updated = existing.map((message) =>
						message.id === localMessageId
							? (item.message as unknown as UIMessage)
							: message,
					);
					saveMessagesToConversation(conversationId, updated);
				},
			};
		},
	};
}
