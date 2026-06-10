import type { UIMessage } from "@tanstack/ai-client";
import { cn } from "@/lib/utils";
import { ChatMessageMetrics } from "./chat-message-metrics";
import type { AssistantPerfMetrics } from "./chat-message-utils";
import {
	buildRenderableAssistantBlocks,
	type GroupedAgentMessagePart,
	shouldShowAssistantThinkingPlaceholder,
} from "./chat-message-utils";
import { AgentMessages } from "./parts/agent-messages/agent-messages";
import { ChatMessageAgentWork } from "./parts/agent-messages/chat-message-agent-work";
import { ChatMessageThinkingPlaceholder } from "./parts/agent-messages/chat-message-thinking-placeholder";
import { UserMessages } from "./parts/user-messages/user-messages";

export type { AssistantPerfMetrics };

export function ChatMessage({
	message,
	metrics,
	isPending,
}: {
	message: UIMessage;
	metrics?: AssistantPerfMetrics;
	isPending?: boolean;
}) {
	const isUser = message.role === "user";
	const pending = isPending ?? metrics?.isStreaming ?? false;
	const showThinkingPlaceholder =
		!isUser && shouldShowAssistantThinkingPlaceholder(message.parts, pending);
	const renderableAssistantBlocks = isUser
		? []
		: buildRenderableAssistantBlocks(message.parts, { isPending: pending });

	return (
		<div
			className={cn(
				"flex flex-col gap-1",
				isUser ? "items-end" : "items-start",
			)}
		>
			<div
				className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
			>
				<div
					className={cn(
						"wrap-break-word whitespace-pre-wrap rounded-lg px-4 py-2 text-sm leading-relaxed",
						isUser
							? "min-w-1/2 md:min-w-2/5 max-w-3/5 bg-primary text-primary-foreground"
							: "w-4/5 max-w-4/5 bg-card border border-border text-card-foreground",
					)}
				>
					{isUser ? (
						message.parts.map((part, index) => (
							<UserMessages
								key={buildMessagePartKey(message, part, index)}
								part={part}
							/>
						))
					) : showThinkingPlaceholder ? (
						<ChatMessageThinkingPlaceholder />
					) : (
						<div className="flex flex-col gap-1">
							{renderableAssistantBlocks.map((block, blockIndex) =>
								block.kind === "agent-work" ? (
									<ChatMessageAgentWork
										key={buildAgentWorkBlockKey(message, block, blockIndex)}
										parts={block.parts}
										blockIndex={blockIndex}
										messageParts={message.parts}
										messageIsPending={pending}
									/>
								) : (
									<AgentMessages
										key={buildGroupedPartKey(message, block.groupedPart)}
										groupedPart={block.groupedPart}
										messageParts={message.parts}
										messageIsPending={pending}
									/>
								),
							)}
						</div>
					)}
				</div>
			</div>
			<ChatMessageMetrics metrics={metrics} show={!isUser} />
		</div>
	);
}

function buildAgentWorkBlockKey(
	message: UIMessage,
	block: Extract<
		ReturnType<typeof buildRenderableAssistantBlocks>[number],
		{ kind: "agent-work" }
	>,
	blockIndex: number,
): string {
	const partKeys = block.parts
		.map((groupedPart, index) => {
			if (groupedPart.kind === "tool-call") {
				const resultSuffix = groupedPart.toolResult
					? `:result:${groupedPart.toolResult.toolCallId}`
					: "";
				return `${index}:tool-call:${groupedPart.toolCall.id}${resultSuffix}`;
			}

			return buildMessagePartKey(message, groupedPart.part, groupedPart.index);
		})
		.join("|");

	return `${message.id}:agent-work:${blockIndex}:${partKeys}`;
}

function buildGroupedPartKey(
	message: UIMessage,
	groupedPart: GroupedAgentMessagePart,
): string {
	if (groupedPart.kind === "tool-call") {
		const resultState = groupedPart.toolResult?.state ?? "pending";
		const resultSuffix = groupedPart.toolResult
			? `:result:${groupedPart.toolResult.toolCallId}:${resultState}`
			: "";
		return `${message.id}:tool-call:${groupedPart.toolCall.id}${resultSuffix}`;
	}

	return buildMessagePartKey(message, groupedPart.part, groupedPart.index);
}

function buildMessagePartKey(
	message: UIMessage,
	part: UIMessage["parts"][number],
	index: number,
): string {
	if (part.type === "tool-call") {
		return `${message.id}:tool-call:${part.id}`;
	}
	if (part.type === "tool-result") {
		return `${message.id}:tool-result:${part.toolCallId}:${index}`;
	}
	if (part.type === "thinking") {
		return `${message.id}:thinking:${index}:${part.content}`;
	}
	return `${message.id}:${part.type}:${index}`;
}
