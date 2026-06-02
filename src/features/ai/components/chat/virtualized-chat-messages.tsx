import type { UIMessage } from "@tanstack/ai-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import type { AssistantPerfMetrics } from "./message/chat-message";
import { ChatMessage } from "./message/chat-message";

interface VirtualizedChatMessagesProps {
	messages: UIMessage[];
	metrics: Record<string, AssistantPerfMetrics | undefined>;
}

/**
 * Virtualized chat message list using @tanstack/react-virtual.
 * Auto-scrolls to bottom when new messages arrive.
 * Falls back to simple rendering for short conversations (≤30 messages).
 */
export function VirtualizedChatMessages({
	messages,
	metrics,
}: VirtualizedChatMessagesProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const prevMessageCountRef = useRef(0);

	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => {
			const msg = messages[index];
			if (!msg) return 80;
			return msg.role === "user" ? 60 : 120;
		},
		overscan: 5,
	});

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messages.length > prevMessageCountRef.current && messages.length > 0) {
			virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
		}
		prevMessageCountRef.current = messages.length;
	}, [messages.length, virtualizer]);

	// For short conversations, skip virtualization overhead
	if (messages.length <= 30) {
		return (
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
				{messages.map((msg) => (
					<ChatMessage key={msg.id} message={msg} metrics={metrics[msg.id]} />
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
					const message = messages[virtualItem.index];
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
							<ChatMessage message={message} metrics={metrics[message.id]} />
						</div>
					);
				})}
			</div>
		</div>
	);
}
