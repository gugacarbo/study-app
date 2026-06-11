import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type { UIMessage } from "@tanstack/ai-client";
import { Badge } from "@/components/ui/badge";
import { useReadOnlyAssistantRuntime } from "@/features/ai/hooks/use-readonly-assistant-runtime";
import { agentStateLabel } from "@/features/ingest/components/ingest-chat-view/stage-labels";
import type { IngestAgentRunViewModel } from "@/features/ingest/components/types";
import { cn } from "@/lib/utils";
import { Thread } from "./thread";

interface AgentRunThreadProps {
	agentName: string;
	agentState: IngestAgentRunViewModel["state"];
	messages: UIMessage[];
	isStreaming?: boolean;
	className?: string;
}

export function AgentRunThread({
	agentName,
	agentState,
	messages,
	isStreaming = false,
	className,
}: AgentRunThreadProps) {
	const runtime = useReadOnlyAssistantRuntime({
		messages,
		isRunning: isStreaming,
	});
	const stateInfo = agentStateLabel(agentState);
	const visibleMessages = messages.filter((message) => {
		if (message.parts.length === 0) return false;
		if (isStreaming) return true;
		return message.parts.some((part) => {
			if (part.type === "text" || part.type === "thinking") {
				return (part.content ?? "").trim().length > 0;
			}
			return true;
		});
	});

	if (visibleMessages.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<div className="flex items-center gap-2 px-1">
				<span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
					{agentName}
				</span>
				<Badge
					variant="secondary"
					className={cn("text-[0.6rem]", stateInfo.className)}
				>
					{stateInfo.text}
				</Badge>
				{isStreaming ? (
					<span className="inline-block size-1.5 animate-pulse rounded-full bg-sky-500 dark:bg-sky-400" />
				) : null}
			</div>
			<div className="min-h-0 overflow-hidden rounded-md">
				<AssistantRuntimeProvider runtime={runtime}>
					<Thread showComposer={false} />
				</AssistantRuntimeProvider>
			</div>
		</div>
	);
}
