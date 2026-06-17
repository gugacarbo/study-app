import type { UIMessage } from "ai";
import type { PageChatContextPayload } from "@/features/ai/context/page-chat-context";
import type { ParsedClientTools } from "@/routes/api/chat/-schema";

export interface BuildChatRequestPayloadInput {
	messages: readonly UIMessage[];
	conversationId: string;
	reviewMode: boolean;
	modelId?: number | null;
	pageContext?: PageChatContextPayload | null;
	clientTools?: ParsedClientTools;
}

export type ChatRequestExportPayload = {
	messages: UIMessage[];
	reviewMode: boolean;
	conversationId: string;
	modelId?: number;
	metadata?: {
		pageContext?: PageChatContextPayload;
	};
	tools?: ParsedClientTools;
};

export function buildChatRequestPayload(
	input: BuildChatRequestPayloadInput,
): ChatRequestExportPayload | null {
	const messages = input.messages.filter((message) => message.id !== "welcome");
	if (messages.length === 0) return null;

	const payload: ChatRequestExportPayload = {
		messages: [...messages],
		reviewMode: input.reviewMode,
		conversationId: input.conversationId,
	};

	if (input.modelId != null) {
		payload.modelId = input.modelId;
	}

	if (input.pageContext) {
		payload.metadata = { pageContext: input.pageContext };
	}

	if (input.clientTools && Object.keys(input.clientTools).length > 0) {
		payload.tools = input.clientTools;
	}

	return payload;
}

export function formatChatRequestPayloadJson(
	payload: ChatRequestExportPayload,
): string {
	return JSON.stringify(payload, null, 2);
}
