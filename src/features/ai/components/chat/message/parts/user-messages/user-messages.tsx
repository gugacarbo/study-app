import type { MessagePart } from "@tanstack/ai-client";
import { ChatMessageTextPart } from "../chat-message-text-part";

function UserMessages({ part }: { part: MessagePart }) {
	return part.type === "text" ? (
		<ChatMessageTextPart content={part.content} msgRole="user" />
	) : null;
}

export { UserMessages };
