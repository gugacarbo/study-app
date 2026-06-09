import type { UIMessage } from "@tanstack/ai-client";
import {
	type GroupedAgentMessagePart,
	resolveThinkingIsPending,
} from "../../chat-message-utils";
import { ChatMessageAgentTextParts } from "./chat-message-agent-text-parts";
import { ChatMessageThinking } from "./chat-message-thinking";
import { ChatMessageToolCall } from "./chat-message-tool-call";
import { ChatMessageToolResult } from "./chat-message-tool-result";

function AgentMessages({
	groupedPart,
	messageParts,
	messageIsPending = false,
}: {
	groupedPart: GroupedAgentMessagePart;
	messageParts?: UIMessage["parts"];
	messageIsPending?: boolean;
}) {
	if (groupedPart.kind === "tool-call") {
		return (
			<ChatMessageToolCall
				part={groupedPart.toolCall}
				toolResult={groupedPart.toolResult}
			/>
		);
	}

	const part = groupedPart.part;
	return part.type === "thinking" ? (
		<ChatMessageThinking
			content={part.content}
			isPending={
				messageParts
					? resolveThinkingIsPending(
							groupedPart.index,
							messageParts,
							messageIsPending,
						)
					: false
			}
		/>
	) : part.type === "text" ? (
		<ChatMessageAgentTextParts content={part.content} />
	) : part.type === "tool-call" ? (
		<ChatMessageToolCall part={part} />
	) : part.type === "tool-result" ? (
		<ChatMessageToolResult part={part} />
	) : null;
}

export { AgentMessages };
