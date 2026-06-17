import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import { cn } from "@/lib/utils";
import { hasVisibleMessageContent } from "./convert-ui-message";
import {
	type PipelineAssistantMode,
	usePipelineAssistantRuntime,
} from "./use-pipeline-assistant-runtime";

export type PipelineThreadLayout = "mini" | "panel" | "embedded";

export interface PipelineThreadHeader {
	title: string;
	status?: { text: string; className: string };
	isStreaming?: boolean;
}

export interface PipelineStageSeparator {
	stageId: string;
	label: string;
	status?: { text: string; className: string };
}

interface PipelineThreadProps {
	messages: UIMessage[];
	isRunning?: boolean;
	mode: PipelineAssistantMode;
	layout?: PipelineThreadLayout;
	header?: PipelineThreadHeader;
	stages?: PipelineStageSeparator[];
	showComposer?: boolean;
	collapsiblePrompts?: boolean;
	composerEnabled?: boolean;
	onSend?: (text: string) => void | Promise<void>;
	emptyState?: ReactNode;
	error?: string | PipelineErrorState | null;
	showInlineAgentErrors?: boolean;
	className?: string;
}

function defaultPanelEmptyState(options: {
	isRunning: boolean;
	header?: PipelineThreadHeader;
}): ReactNode {
	const { isRunning, header } = options;
	const streaming = isRunning || header?.isStreaming;

	if (streaming) {
		return (
			<span className="inline-flex items-center gap-2">
				<Loader2 className="size-4 animate-spin" />
				Waiting for agent output...
			</span>
		);
	}

	if (header?.status?.text === "Pending" || header?.status?.text === "Idle") {
		return "Waiting to start…";
	}

	return "No messages yet.";
}

function StageSeparator({ stage }: { stage: PipelineStageSeparator }) {
	return (
		<div className="flex items-center gap-2 py-1">
			<Separator className="flex-1" />
			<Badge
				variant="secondary"
				className={cn(
					"shrink-0 text-[0.6rem] font-medium",
					stage.status?.className,
				)}
			>
				{stage.label}
			</Badge>
			<Separator className="flex-1" />
		</div>
	);
}

export function PipelineThread({
	messages = [],
	isRunning = false,
	mode,
	layout = "panel",
	header,
	stages = [],
	showComposer,
	collapsiblePrompts = true,
	composerEnabled = false,
	onSend,
	emptyState,
	error,
	showInlineAgentErrors = true,
	className,
}: PipelineThreadProps) {
	const visibleMessages = messages.filter((message) =>
		hasVisibleMessageContent(message, isRunning),
	);
	const runtime = usePipelineAssistantRuntime({
		messages: visibleMessages,
		isRunning,
		mode,
		composerEnabled,
		onSend,
	});

	const resolvedShowComposer =
		showComposer ?? (mode === "follow-up" && composerEnabled);

	const inlineError =
		showInlineAgentErrors && error
			? typeof error === "string"
				? error
				: error.message
			: null;

	if (visibleMessages.length === 0 && layout === "mini") {
		return null;
	}

	const threadContent =
		visibleMessages.length === 0 ? (
			<div
				className={cn(
					"flex min-h-0 flex-1 items-center justify-center text-muted-foreground",
					layout === "panel"
						? "rounded-md border border-border bg-muted p-3 text-sm"
						: "text-xs",
				)}
			>
				{emptyState ??
					defaultPanelEmptyState({
						isRunning,
						header,
					})}
			</div>
		) : (
			<StudyAssistantRuntimeProvider runtime={runtime}>
				<Thread
					showComposer={resolvedShowComposer}
					collapsiblePrompts={collapsiblePrompts}
				/>
			</StudyAssistantRuntimeProvider>
		);

	if (layout === "embedded") {
		return (
			<div className={cn("min-h-0 overflow-hidden", className)}>
				{stages.map((stage) => (
					<StageSeparator key={stage.stageId} stage={stage} />
				))}
				{threadContent}
			</div>
		);
	}

	if (layout === "mini") {
		return (
			<div className={cn("flex flex-col gap-1", className)}>
				{header ? (
					<div className="flex items-center gap-2 px-1">
						<span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
							{header.title}
						</span>
						{header.status ? (
							<Badge
								variant="secondary"
								className={cn("text-[0.6rem]", header.status.className)}
							>
								{header.status.text}
							</Badge>
						) : null}
						{header.isStreaming || isRunning ? (
							<span className="inline-block size-1.5 animate-pulse rounded-full bg-sky-500 dark:bg-sky-400" />
						) : null}
					</div>
				) : null}
				{inlineError ? (
					<div className="px-1 text-[0.65rem] text-destructive">
						{inlineError}
					</div>
				) : null}
				{stages.map((stage) => (
					<StageSeparator key={stage.stageId} stage={stage} />
				))}
				<div className="min-h-0 overflow-hidden rounded-md">
					{threadContent}
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-muted",
				className,
			)}
		>
			{header ? (
				<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
					<span className="text-sm font-medium">{header.title}</span>
					{header.status ? (
						<Badge
							variant="secondary"
							className={cn("text-[0.65rem]", header.status.className)}
						>
							{header.status.text}
						</Badge>
					) : null}
					{header.isStreaming || isRunning ? (
						<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
					) : null}
				</div>
			) : null}
			{stages.map((stage) => (
				<div key={stage.stageId} className="px-3 pt-2">
					<StageSeparator stage={stage} />
				</div>
			))}
			<div className="min-h-0 flex-1 overflow-hidden">{threadContent}</div>
		</div>
	);
}
