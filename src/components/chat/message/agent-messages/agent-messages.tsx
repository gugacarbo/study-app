import type { MessagePart } from "@tanstack/ai-client";
import { ChatMessageTextPart } from "../user-messages/chat-message-text-part";
import { ChatMessageThinking } from "./chat-message-thinking";
import { ChatMessageToolCall } from "./chat-message-tool-call";
import { ChatMessageToolResult } from "./chat-message-tool-result";

function AgentMessages({ part }: { part: MessagePart }) {
	return part.type === "text" ? (
		<ChatMessageTextPart part={part} msgRole="assistant" />
	) : part.type === "thinking" ? (
		<ChatMessageThinking part={part} />
	) : part.type === "tool-call" ? (
		<ChatMessageToolCall part={part} />
	) : part.type === "tool-result" ? (
		<ChatMessageToolResult part={part} />
	) : null;
}

export { AgentMessages };
