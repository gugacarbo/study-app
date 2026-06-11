import { useEffect, useMemo, useRef } from "react";
import { IMPROVE_QUESTIONS_STAGE_ID } from "@/features/ai/agents/improve-questions/contracts";
import { AgentRunThread } from "@/features/ai/components/assistant-ui/agent-run-thread";
import type { IngestAgentRunViewModel } from "@/features/ingest/components/types";
import type {
	ImproveQuestionsAgentStatus,
	ImproveQuestionsUIMessage,
} from "./types";

interface AgentStreamPanelProps {
	messages: ImproveQuestionsUIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveQuestionsAgentStatus;
}

interface ImproveQuestionsStreamBubble {
	id: string;
	agentRunId: string;
	agentName: string;
	agentState: IngestAgentRunViewModel["state"];
	stageId: typeof IMPROVE_QUESTIONS_STAGE_ID;
	message: ImproveQuestionsUIMessage;
	isStreaming: boolean;
}

function mapAgentState(
	status: ImproveQuestionsAgentStatus,
): ImproveQuestionsStreamBubble["agentState"] {
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
	messages: ImproveQuestionsUIMessage[],
	isStreaming: boolean,
	agentStatus: ImproveQuestionsAgentStatus,
): ImproveQuestionsStreamBubble[] {
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
