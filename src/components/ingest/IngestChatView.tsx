import type { UIMessage } from "@tanstack/ai-client";
import { useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChatMessage } from "@/features/ai/components/chat/message/chat-message";
import { cn } from "@/lib/utils";
import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "./types";

interface IngestChatViewProps {
	agents: IngestAgentRunViewModel[];
	stages: IngestPipelineStageViewModel[];
	selectedStageId: string | null;
}

/** A single message bubble in the ingest chat view. */
interface ChatBubble {
	id: string;
	agentRunId: string;
	agentName: string;
	agentState: IngestAgentRunViewModel["state"];
	stageId: string;
	role: "system" | "user" | "assistant";
	content: string;
	isStreaming: boolean;
}

function agentStateLabel(state: IngestAgentRunViewModel["state"]): {
	text: string;
	className: string;
} {
	switch (state) {
		case "running":
			return {
				text: "Running",
				className:
					"bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
			};
		case "success":
			return {
				text: "Done",
				className:
					"bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
			};
		case "warning":
			return {
				text: "Warning",
				className:
					"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
			};
		case "error":
			return {
				text: "Error",
				className:
					"bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
			};
		default:
			return {
				text: "Pending",
				className:
					"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			};
	}
}

function stageStatusLabel(status: IngestPipelineStageViewModel["status"]): {
	text: string;
	className: string;
} {
	switch (status) {
		case "running":
			return {
				text: "Running",
				className:
					"bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
			};
		case "done":
			return {
				text: "Done",
				className:
					"bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
			};
		case "warning":
			return {
				text: "Warning",
				className:
					"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
			};
		case "error":
			return {
				text: "Error",
				className:
					"bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
			};
		case "skipped":
			return {
				text: "Skipped",
				className:
					"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			};
		default:
			return {
				text: "Pending",
				className:
					"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			};
	}
}

function buildChatBubbles(
	agents: IngestAgentRunViewModel[],
	stages: IngestPipelineStageViewModel[],
): ChatBubble[] {
	const bubbles: ChatBubble[] = [];

	// Build a stage index for ordering
	const stageOrder = new Map<string, number>();
	for (const stage of stages) {
		stageOrder.set(stage.stageId, stageOrder.size);
	}

	// Sort agents by stage order, then by their position within the stage
	const sortedAgents = [...agents].sort((a, b) => {
		const aOrder = stageOrder.get(a.stageId) ?? 0;
		const bOrder = stageOrder.get(b.stageId) ?? 0;
		if (aOrder !== bOrder) return aOrder - bOrder;
		return (a.startedAt ?? 0) - (b.startedAt ?? 0);
	});

	for (const agent of sortedAgents) {
		const isStreaming = agent.state === "running";

		// System prompt bubble
		if (agent.systemPrompt) {
			bubbles.push({
				id: `${agent.id}-system`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "system",
				content: agent.systemPrompt,
				isStreaming: false,
			});
		}

		// User prompt bubble
		if (agent.userPrompt) {
			bubbles.push({
				id: `${agent.id}-user`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "user",
				content: agent.userPrompt,
				isStreaming: false,
			});
		}

		// Assistant response bubble — streams in real time
		if (agent.response || isStreaming) {
			bubbles.push({
				id: `${agent.id}-assistant`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "assistant",
				content: agent.response ?? "",
				isStreaming,
			});
		}

		// Error bubble
		if (agent.error) {
			bubbles.push({
				id: `${agent.id}-error`,
				agentRunId: agent.id,
				agentName: agent.name,
				agentState: agent.state,
				stageId: agent.stageId,
				role: "system",
				content: agent.error,
				isStreaming: false,
			});
		}
	}

	return bubbles;
}

export function IngestChatView({
	agents,
	stages = [],
	selectedStageId,
}: IngestChatViewProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const bubbles = useMemo(
		() => buildChatBubbles(agents, stages),
		[agents, stages],
	);

	const filteredBubbles = useMemo(
		() =>
			selectedStageId
				? bubbles.filter((b) => b.stageId === selectedStageId)
				: bubbles,
		[bubbles, selectedStageId],
	);

	// Auto-scroll to bottom on new content
	const prevBubbleCountRef = useRef(0);
	useEffect(() => {
		if (filteredBubbles.length > prevBubbleCountRef.current) {
			requestAnimationFrame(() => {
				scrollRef.current?.scrollTo({
					top: scrollRef.current.scrollHeight,
					behavior: "smooth",
				});
			});
		}
		prevBubbleCountRef.current = filteredBubbles.length;
	}, [filteredBubbles.length]);

	// Group bubbles by agent, inserting stage separators
	const groupedBubbles = useMemo(() => {
		const groups: Array<{
			type: "stage" | "bubble";
			stageId: string;
			stageLabel?: string;
			stageStatus?: IngestPipelineStageViewModel["status"];
			bubble?: ChatBubble;
		}> = [];

		let lastStageId: string | null = null;

		for (const bubble of filteredBubbles) {
			if (bubble.stageId !== lastStageId) {
				const stage = stages.find((s) => s.stageId === bubble.stageId);
				groups.push({
					type: "stage",
					stageId: bubble.stageId,
					stageLabel: stage?.label ?? bubble.stageId,
					stageStatus: stage?.status,
				});
				lastStageId = bubble.stageId;
			}
			groups.push({ type: "bubble", stageId: bubble.stageId, bubble });
		}

		return groups;
	}, [filteredBubbles, stages]);

	return (
		<div
			ref={scrollRef}
			className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-muted p-3"
		>
			{groupedBubbles.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
					Waiting for agent output...
				</div>
			)}
			{groupedBubbles.map((item) => {
				if (item.type === "stage") {
					const statusInfo = stageStatusLabel(item.stageStatus ?? "pending");
					return (
						<div
							key={`stage-${item.stageId}`}
							className="flex items-center gap-2 py-1"
						>
							<Separator className="flex-1" />
							<Badge
								variant="secondary"
								className={cn(
									"shrink-0 text-[0.6rem] font-medium",
									statusInfo.className,
								)}
							>
								{item.stageLabel}
							</Badge>
							<Separator className="flex-1" />
						</div>
					);
				}

				if (!item.bubble) return null;
				return <BubbleMessage key={item.bubble.id} bubble={item.bubble} />;
			})}
		</div>
	);
}

function BubbleMessage({ bubble }: { bubble: ChatBubble }) {
	const stateInfo = agentStateLabel(bubble.agentState);

	const uiMessage: UIMessage = useMemo(
		() => ({
			id: bubble.id,
			role: bubble.role,
			parts: [{ type: "text", content: bubble.content }],
		}),
		[bubble.id, bubble.role, bubble.content],
	);

	// System messages get a special treatment — collapsible panel style
	if (bubble.role === "system") {
		return (
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2 px-1">
					<span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
						{bubble.agentName}
					</span>
					<Badge
						variant="secondary"
						className={cn("text-[0.6rem]", stateInfo.className)}
					>
						{stateInfo.text}
					</Badge>
				</div>
				<div className="rounded-md border border-amber-500/20 bg-amber-100 dark:bg-amber-500/10 px-3 py-2 text-[0.7rem] leading-relaxed whitespace-pre-wrap text-foreground/80">
					{bubble.content}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2 px-1">
				<span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
					{bubble.agentName}
				</span>
				{bubble.role === "assistant" && bubble.isStreaming && (
					<span className="inline-block size-1.5 animate-pulse rounded-full bg-sky-500 dark:bg-sky-400" />
				)}
			</div>
			<ChatMessage message={uiMessage} />
		</div>
	);
}
