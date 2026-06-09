import type { UIMessage } from "@tanstack/ai-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import type { AssistantPerfMetrics } from "./message/chat-message";
import { mergeAssistantTurnMessages } from "./message/chat-message-utils";
import { ChatMessage } from "./message/chat-message";

interface VirtualizedChatMessagesProps {
	messages: UIMessage[];
	metrics: Record<string, AssistantPerfMetrics | undefined>;
	isLoading: boolean;
}

/**
 * Virtualized chat message list using @tanstack/react-virtual.
 * Auto-scrolls to bottom when new messages arrive.
 * Falls back to simple rendering for short conversations (≤30 messages).
 */
export function VirtualizedChatMessages({
	messages,
	metrics,
	isLoading,
}: VirtualizedChatMessagesProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const prevMessageCountRef = useRef(0);

	const displayMessages = useMemo(
		() => mergeAssistantTurnMessages(messages),
		[messages],
	);

	const latestAssistantId = useMemo(() => {
		for (let i = displayMessages.length - 1; i >= 0; i -= 1) {
			const message = displayMessages[i];
			if (message?.role === "assistant" && message.id !== "welcome") {
				return message.id;
			}
		}
		return undefined;
	}, [displayMessages]);

	const virtualizer = useVirtualizer({
		count: displayMessages.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => {
			const msg = displayMessages[index];
			if (!msg) return 80;
			return msg.role === "user" ? 60 : 120;
		},
		overscan: 5,
	});

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (
			displayMessages.length > prevMessageCountRef.current &&
			displayMessages.length > 0
		) {
			virtualizer.scrollToIndex(displayMessages.length - 1, { align: "end" });
		}
		prevMessageCountRef.current = displayMessages.length;
	}, [displayMessages.length, virtualizer]);

	// For short conversations, skip virtualization overhead
	if (displayMessages.length <= 30) {
		return (
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
				{displayMessages.map((msg) => (
					<ChatMessage
						key={msg.id}
						message={msg}
						metrics={metrics[msg.id]}
						isPending={
							isLoading &&
							msg.role === "assistant" &&
							msg.id === latestAssistantId
						}
					/>
				))}
			</div>
		);
	}

	return (
		<div
			ref={parentRef}
			className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
			data-testid="virtualized-chat-messages"
		>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const message = displayMessages[virtualItem.index];
					if (!message) return null;

					return (
						<div
							key={message.id}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualItem.start}px)`,
							}}
							data-index={virtualItem.index}
							ref={virtualizer.measureElement}
						>
							<ChatMessage
								message={message}
								metrics={metrics[message.id]}
								isPending={
									isLoading &&
									message.role === "assistant" &&
									message.id === latestAssistantId
								}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}
