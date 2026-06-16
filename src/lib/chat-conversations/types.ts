import type { UIMessage } from "ai";

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/** JSON-serializable message shape for server function boundaries. */
export interface StoredChatMessage {
	id: string;
	role: string;
	parts: JsonValue[];
	metadata?: { [key: string]: JsonValue };
}

export interface ChatConversationSummary {
	id: string;
	title: string;
	messageCount: number;
	contextKey: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ChatConversationRecord {
	id: string;
	title: string;
	r2_key: string;
	message_count: number;
	context_key: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export interface ChatConversationPayload {
	messages: StoredChatMessage[];
}

function toJsonValue(value: unknown): JsonValue {
	return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export function toStoredMessages(messages: UIMessage[]): StoredChatMessage[] {
	return messages.map((message) => ({
		id: message.id,
		role: message.role,
		parts: message.parts.map((part) => toJsonValue(part)),
		metadata:
			message.metadata && typeof message.metadata === "object"
				? (toJsonValue(message.metadata) as { [key: string]: JsonValue })
				: undefined,
	}));
}

export function fromStoredMessages(messages: StoredChatMessage[]): UIMessage[] {
	return messages as UIMessage[];
}
