import type { UIMessage } from "ai";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "./constants";

export function trimMessagesForRuntime(
	messages: UIMessage[],
	limit = CHAT_RUNTIME_MESSAGE_LIMIT,
): UIMessage[] {
	if (messages.length <= limit) return messages;
	return messages.slice(-limit);
}

export function mergeMessagesForSave(
	fullMessages: UIMessage[],
	runtimeWindow: UIMessage[],
): UIMessage[] {
	if (runtimeWindow.length === 0) return fullMessages;
	if (fullMessages.length === 0) return runtimeWindow;

	const firstWindowId = runtimeWindow[0]?.id;
	if (!firstWindowId) return runtimeWindow;

	const overlapIndex = fullMessages.findIndex(
		(message) => message.id === firstWindowId,
	);
	if (overlapIndex >= 0) {
		return [...fullMessages.slice(0, overlapIndex), ...runtimeWindow];
	}

	return [...fullMessages, ...runtimeWindow];
}
