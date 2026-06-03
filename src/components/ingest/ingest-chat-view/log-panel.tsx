import type { UIMessage } from "@tanstack/ai-client";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChatMessage } from "@/features/ai/components/chat/message/chat-message";
import { cn } from "@/lib/utils";
import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "../types";
import type { ChatBubble } from "./chat-bubbles";

export function agentStateLabel(state: IngestAgentRunViewModel["state"]): {
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

export function stageStatusLabel(
	status: IngestPipelineStageViewModel["status"],
): { text: string; className: string } {
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

export function BubbleMessage({ bubble }: { bubble: ChatBubble }) {
	const stateInfo = agentStateLabel(bubble.agentState);

	const uiMessage: UIMessage = useMemo(
		() => ({
			id: bubble.id,
			role: bubble.role,
			parts: [{ type: "text", content: bubble.content }],
		}),
		[bubble.id, bubble.role, bubble.content],
	);

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
