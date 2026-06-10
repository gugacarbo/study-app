import type { UIMessage } from "@tanstack/ai-client";
import { useEffect, useRef } from "react";
import { BubbleMessage } from "@/features/ingest/components/ingest-chat-view/log-panel";
import type { ChatBubble } from "@/features/ingest/components/ingest-chat-view/chat-bubbles";
import { IMPROVE_OPTIONS_STAGE_ID } from "@/features/ai/agents/improve-options/contracts";
import type { ImproveOptionsAgentStatus } from "./types";

interface AgentStreamPanelProps {
	messages: UIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveOptionsAgentStatus;
}

function mapAgentState(
	status: ImproveOptionsAgentStatus,
): ChatBubble["agentState"] {
	switch (status) {
		case "running":
			return "running";
		case "done":
			return "success";
		case "error":
			return "error";
		default:
			return "pending";
	}
}

function toChatBubbles(
	messages: UIMessage[],
	isStreaming: boolean,
	agentStatus: ImproveOptionsAgentStatus,
): ChatBubble[] {
	const visibleMessages = messages.filter((message) => message.parts.length > 0);
	const agentState = mapAgentState(agentStatus);
	const lastAssistantId = [...visibleMessages]
		.reverse()
		.find((message) => message.role === "assistant")?.id;

	return visibleMessages.map((message) => ({
		id: message.id,
		agentRunId: "improve-options",
		agentName: "Improve Options",
		agentState,
		stageId: IMPROVE_OPTIONS_STAGE_ID,
		message,
		isStreaming:
			isStreaming &&
			message.role === "assistant" &&
			message.id === lastAssistantId,
	}));
}

export function AgentStreamPanel({
	messages,
	isStreaming,
	agentStatus,
}: AgentStreamPanelProps) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const bubbles = toChatBubbles(messages, isStreaming, agentStatus);

	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [bubbles.length, isStreaming]);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
			<p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Agent stream
			</p>
			<div
				ref={scrollRef}
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-muted p-3"
			>
				{bubbles.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{agentStatus === "idle"
							? "Waiting to start…"
							: "No messages yet."}
					</p>
				) : (
					bubbles.map((bubble) => (
						<BubbleMessage key={bubble.id} bubble={bubble} />
					))
				)}
			</div>
		</div>
	);
}
