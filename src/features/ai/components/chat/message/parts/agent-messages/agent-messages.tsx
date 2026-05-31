import type { MessagePart } from "@tanstack/ai-client";
import { ChatMessageAgentTextParts } from "./chat-message-agent-text-parts";
import { ChatMessageThinking } from "./chat-message-thinking";
import { ChatMessageToolCall } from "./chat-message-tool-call";
import { ChatMessageToolResult } from "./chat-message-tool-result";

function AgentMessages({ part }: { part: MessagePart }) {
	return part.type === "thinking" ? (
		<ChatMessageThinking content={part.content} />
	) : part.type === "text" ? (
		<ChatMessageAgentTextParts content={part.content} />
	) : part.type === "tool-call" ? (
		<ChatMessageToolCall part={part} />
	) : part.type === "tool-result" ? (
		<ChatMessageToolResult part={part} />
	) : null;
}

export { AgentMessages };
