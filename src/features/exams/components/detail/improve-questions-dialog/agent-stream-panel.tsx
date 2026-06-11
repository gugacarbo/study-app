import type { UIMessage } from "@tanstack/ai-client";
import { useEffect, useMemo, useRef } from "react";
import { IMPROVE_QUESTIONS_STAGE_ID } from "@/features/ai/agents/improve-questions/contracts";
import { AgentRunThread } from "@/features/ai/components/assistant-ui/agent-run-thread";
import type { ChatBubble } from "@/features/ingest/components/ingest-chat-view/chat-bubbles";
import type { ImproveQuestionsAgentStatus } from "./types";

interface AgentStreamPanelProps {
	messages: UIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveQuestionsAgentStatus;
}

function mapAgentState(
	status: ImproveQuestionsAgentStatus,
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
	agentStatus: ImproveQuestionsAgentStatus,
): ChatBubble[] {
	const visibleMessages = messages.filter(
		(message) => message.parts.length > 0,
	);
	const agentState = mapAgentState(agentStatus);
	const lastAssistantId = [...visibleMessages]
		.reverse()
		.find((message) => message.role === "assistant")?.id;

	return visibleMessages.map((message) => ({
		id: message.id,
		agentRunId: "improve-questions",
		agentName: "Improve Question",
		agentState,
		stageId: IMPROVE_QUESTIONS_STAGE_ID,
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
	const bubbles = useMemo(
		() => toChatBubbles(messages, isStreaming, agentStatus),
		[messages, isStreaming, agentStatus],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when stream bubbles update
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [bubbles]);

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
						{agentStatus === "idle" ? "Waiting to start…" : "No messages yet."}
					</p>
				) : (
					bubbles.map((bubble) => (
						<AgentRunThread
							key={bubble.id}
							agentName={bubble.agentName}
							agentState={bubble.agentState}
							messages={[bubble.message]}
							isStreaming={bubble.isStreaming}
						/>
					))
				)}
			</div>
		</div>
	);
}
