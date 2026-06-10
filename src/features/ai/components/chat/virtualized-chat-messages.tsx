import type { UIMessage } from "@tanstack/ai-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import type { AssistantPerfMetrics } from "./message/chat-message";
import { ChatMessage } from "./message/chat-message";
import { mergeAssistantTurnMessages } from "./message/chat-message-utils";

const MESSAGE_GAP_PX = 16;
const NEAR_BOTTOM_THRESHOLD = 150;
const OVERSCAN = 10;
const VIRTUALIZE_THRESHOLD = 30;

interface VirtualizedChatMessagesProps {
	messages: UIMessage[];
	metrics: Record<string, AssistantPerfMetrics | undefined>;
	isLoading: boolean;
}

export function estimateMessageHeight(msg: UIMessage): number {
	if (msg.role === "user") {
		const textLen = msg.parts
			.filter((part) => part.type === "text")
			.reduce((sum, part) => sum + (part.content?.length ?? 0), 0);
		const lines = Math.max(1, Math.ceil(textLen / 60));
		return 52 + lines * 22;
	}

	if (msg.role === "assistant") {
		const toolCallCount = msg.parts.filter(
			(part) => part.type === "tool-call" || part.type === "tool-result",
		).length;
		const textLen = msg.parts
			.filter((part) => part.type === "text")
			.reduce((sum, part) => sum + (part.content?.length ?? 0), 0);
		const textLines = Math.max(1, Math.ceil(textLen / 80));
		return 52 + textLines * 22 + toolCallCount * 90;
	}

	return 80;
}

/**
 * While the assistant is streaming, keep the growing message out of the
 * virtualizer so height changes do not relayout the whole list.
 */
export function splitStreamingTail(
	messages: UIMessage[],
	isLoading: boolean,
): { head: UIMessage[]; tail: UIMessage | null } {
	if (!isLoading || messages.length === 0) {
		return { head: messages, tail: null };
	}

	const lastMessage = messages.at(-1);
	if (lastMessage?.role !== "assistant") {
		return { head: messages, tail: null };
	}

	return {
		head: messages.slice(0, -1),
		tail: lastMessage,
	};
}

function usePinnedBottomScroll(
	parentRef: RefObject<HTMLDivElement | null>,
	observeTargetRef: RefObject<HTMLElement | null>,
	isNearBottomRef: RefObject<boolean>,
	observeKey: string,
) {
	const scrollRafRef = useRef<number | null>(null);

	const scrollToBottomIfPinned = useCallback(() => {
		if (!isNearBottomRef.current) return;

		if (scrollRafRef.current !== null) {
			cancelAnimationFrame(scrollRafRef.current);
		}

		scrollRafRef.current = requestAnimationFrame(() => {
			scrollRafRef.current = null;
			const element = parentRef.current;
			if (element) {
				element.scrollTop = element.scrollHeight;
			}
		});
	}, [isNearBottomRef, parentRef]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: observeKey re-subscribes when the pinned tail element changes
	useLayoutEffect(() => {
		const target = observeTargetRef.current;
		if (!target) return;

		const observer = new ResizeObserver(() => {
			scrollToBottomIfPinned();
		});
		observer.observe(target);
		return () => observer.disconnect();
	}, [observeKey, observeTargetRef, scrollToBottomIfPinned]);

	return scrollToBottomIfPinned;
}

function useStableStreamingHead(
	messages: UIMessage[],
	isLoading: boolean,
): { head: UIMessage[]; tail: UIMessage | null } {
	const headRef = useRef<UIMessage[]>([]);

	return useMemo(() => {
		const split = splitStreamingTail(messages, isLoading);
		const headUnchanged =
			split.tail !== null &&
			split.head.length === headRef.current.length &&
			split.head.every(
				(message, index) => message.id === headRef.current[index]?.id,
			);

		if (headUnchanged) {
			return { head: headRef.current, tail: split.tail };
		}

		headRef.current = split.head;
		return split;
	}, [messages, isLoading]);
}

function resolveLatestAssistantId(messages: UIMessage[]): string | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "assistant" && message.id !== "welcome") {
			return message.id;
		}
	}
	return undefined;
}

interface ChatMessageListProps {
	messages: UIMessage[];
	metrics: Record<string, AssistantPerfMetrics | undefined>;
	isLoading: boolean;
	latestAssistantId?: string;
	listRef?: RefObject<HTMLDivElement | null>;
	tailRef?: RefObject<HTMLDivElement | null>;
	listBottomRef?: RefObject<HTMLDivElement | null>;
	className?: string;
	testId?: string;
	onScroll?: () => void;
}

function ChatMessageList({
	messages,
	metrics,
	isLoading,
	latestAssistantId,
	listRef,
	tailRef,
	listBottomRef,
	className,
	testId,
	onScroll,
}: ChatMessageListProps) {
	const resolvedLatestAssistantId =
		latestAssistantId ?? resolveLatestAssistantId(messages);
	const { head, tail } = useStableStreamingHead(messages, isLoading);
	const renderedHead = tail ? head : messages;

	return (
		<div
			ref={listRef}
			className={className}
			data-testid={testId}
			onScroll={onScroll}
		>
			{renderedHead.map((message) => (
				<div key={message.id} className="pb-4 last:pb-0">
					<ChatMessage
						message={message}
						metrics={metrics[message.id]}
						isPending={
							isLoading &&
							message.role === "assistant" &&
							message.id === resolvedLatestAssistantId
						}
					/>
				</div>
			))}
			{tail ? (
				<div ref={tailRef}>
					<ChatMessage
						message={tail}
						metrics={metrics[tail.id]}
						isPending={isLoading}
					/>
				</div>
			) : (
				<div
					ref={listBottomRef}
					aria-hidden
					className="h-px w-full shrink-0"
				/>
			)}
		</div>
	);
}

/**
 * Virtualized chat message list using @tanstack/react-virtual.
 * Streaming output is pinned outside the virtualizer to avoid flicker.
 */
export function VirtualizedChatMessages({
	messages,
	metrics,
	isLoading,
}: VirtualizedChatMessagesProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const tailRef = useRef<HTMLDivElement>(null);
	const listBottomRef = useRef<HTMLDivElement>(null);
	const isNearBottomRef = useRef(true);
	const prevVirtualCountRef = useRef(0);

	const displayMessages = useMemo(
		() => mergeAssistantTurnMessages(messages),
		[messages],
	);

	const latestAssistantId = useMemo(
		() => resolveLatestAssistantId(displayMessages),
		[displayMessages],
	);

	const { head, tail } = useStableStreamingHead(displayMessages, isLoading);
	const virtualizedMessages = tail ? head : displayMessages;
	const shouldVirtualize = displayMessages.length > VIRTUALIZE_THRESHOLD;

	const handleScroll = useCallback(() => {
		const element = parentRef.current;
		if (!element) return;
		const distanceFromBottom =
			element.scrollHeight - element.scrollTop - element.clientHeight;
		isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
	}, []);

	const observeTargetRef = tail ? tailRef : listBottomRef;
	const scrollToBottomIfPinned = usePinnedBottomScroll(
		parentRef,
		observeTargetRef,
		isNearBottomRef,
		tail?.id ?? "bottom",
	);

	const virtualizer = useVirtualizer({
		count: shouldVirtualize ? virtualizedMessages.length : 0,
		getScrollElement: () => parentRef.current,
		getItemKey: (index) => virtualizedMessages[index]?.id ?? String(index),
		estimateSize: (index) => {
			const message = virtualizedMessages[index];
			if (!message) return 80;
			return estimateMessageHeight(message);
		},
		gap: MESSAGE_GAP_PX,
		overscan: OVERSCAN,
		measureElement:
			typeof window !== "undefined"
				? (element) => element?.getBoundingClientRect().height ?? 0
				: undefined,
	});

	useEffect(() => {
		const nextCount = virtualizedMessages.length;
		const hasNewVirtualizedMessage = nextCount > prevVirtualCountRef.current;
		prevVirtualCountRef.current = nextCount;

		if (hasNewVirtualizedMessage) {
			scrollToBottomIfPinned();
		}
	}, [virtualizedMessages.length, scrollToBottomIfPinned]);

	useEffect(() => {
		if (tail) {
			scrollToBottomIfPinned();
		}
	}, [tail?.id, scrollToBottomIfPinned, tail]);

	if (!shouldVirtualize) {
		return (
			<ChatMessageList
				messages={displayMessages}
				metrics={metrics}
				isLoading={isLoading}
				latestAssistantId={latestAssistantId}
				listRef={parentRef}
				tailRef={tailRef}
				listBottomRef={listBottomRef}
				className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
				testId="virtualized-chat-messages"
				onScroll={handleScroll}
			/>
		);
	}

	return (
		<div
			ref={parentRef}
			className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
			data-testid="virtualized-chat-messages"
			onScroll={handleScroll}
		>
			{virtualizedMessages.length > 0 ? (
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: "100%",
						position: "relative",
					}}
				>
					{virtualizer.getVirtualItems().map((virtualItem) => {
						const message = virtualizedMessages[virtualItem.index];
						if (!message) return null;

						return (
							<div
								key={virtualItem.key}
								data-index={virtualItem.index}
								ref={virtualizer.measureElement}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									transform: `translateY(${virtualItem.start}px)`,
								}}
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
			) : null}
			{tail ? (
				<div
					ref={tailRef}
					className={virtualizedMessages.length > 0 ? "mt-4" : undefined}
				>
					<ChatMessage
						message={tail}
						metrics={metrics[tail.id]}
						isPending={isLoading}
					/>
				</div>
			) : (
				<div ref={listBottomRef} aria-hidden className="h-px w-full shrink-0" />
			)}
		</div>
	);
}
