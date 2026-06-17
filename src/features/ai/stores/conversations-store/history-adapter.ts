import type {
	GenericThreadHistoryAdapter,
	MessageFormatAdapter,
	MessageFormatItem,
	ThreadHistoryAdapter,
} from "@assistant-ui/core";
import type { UIMessage } from "ai";
import { mergePreservedChatPerf } from "@/features/ai/lib/chat-message-perf";
import { saveMessagesToConversation } from "./actions";
import { getConversationMessages } from "./selectors";
import { conversationsStore } from "./types";

function applyStoredMessageUpdate(
	existing: UIMessage[],
	messageId: string,
	incoming: UIMessage,
): UIMessage[] {
	const index = existing.findIndex((message) => message.id === messageId);
	if (index < 0) return [...existing, incoming];

	return existing.map((message, i) =>
		i === index ? mergePreservedChatPerf(message, incoming) : message,
	);
}

function toMessageRepository<TMessage>(
	messages: TMessage[],
	getId: (message: TMessage) => string,
): MessageFormatItem<TMessage>[] {
	return messages.map((message, index) => ({
		parentId: index === 0 ? null : getId(messages[index - 1] as TMessage),
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

					const updated = applyStoredMessageUpdate(
						existing,
						messageId,
						item.message as unknown as UIMessage,
					);

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

					const updated = applyStoredMessageUpdate(
						existing,
						localMessageId,
						item.message as unknown as UIMessage,
					);
					saveMessagesToConversation(conversationId, updated);
				},
			};
		},
	};
}
