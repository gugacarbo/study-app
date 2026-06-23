"use client";

import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
	Reasoning,
	ReasoningContent,
	ReasoningRoot,
	ReasoningText,
	ReasoningTrigger,
} from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import {
	ToolGroupContent,
	ToolGroupRoot,
	ToolGroupTrigger,
	shouldRenderToolGroup,
} from "@/components/assistant-ui/tool-group";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
	AuiIf,
	groupPartByType,
	MessagePrimitive,
	ThreadPrimitive,
	useAuiState,
} from "@assistant-ui/react";
import { ArrowDownIcon } from "lucide-react";
import type { FC } from "react";

export type IngestThreadProps = {
	isRunning: boolean;
};

const IngestThreadMessage: FC = () => {
	const role = useAuiState((s) => s.message.role);
	if (role === "system") return <IngestSystemMessage />;
	return <IngestAssistantMessage />;
};

const IngestSystemMessage: FC = () => (
	<MessagePrimitive.Root
		className="flex w-full justify-center py-1"
		data-role="system"
	>
		<div className="rounded-full bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
			<MessagePrimitive.Parts />
		</div>
	</MessagePrimitive.Root>
);

const IngestAssistantMessage: FC = () => (
	<MessagePrimitive.Root
		data-role="assistant"
		className="fade-in slide-in-from-bottom-1 animate-in relative duration-150"
	>
		<div className="text-foreground px-2 leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]">
			<MessagePrimitive.GroupedParts
				groupBy={groupPartByType({
					reasoning: ["group-chainOfThought", "group-reasoning"],
					"tool-call": ["group-chainOfThought", "group-tool"],
					"standalone-tool-call": [],
				})}
			>
				{({ part, children }) => {
					switch (part.type) {
						case "text":
							return <MarkdownText />;
						case "reasoning":
							return <Reasoning {...part} />;
						case "tool-call":
							return <ToolFallback {...part} />;
						case "group-chainOfThought":
							return (
								<div data-slot="aui_chain-of-thought" className="mb-3">
									{children}
								</div>
							);
						case "group-tool":
							if (!shouldRenderToolGroup(part.indices.length)) {
								return <>{children}</>;
							}
							return (
								<ToolGroupRoot variant="ghost">
									<ToolGroupTrigger
										count={part.indices.length}
										active={part.status.type === "running"}
									/>
									<ToolGroupContent>{children}</ToolGroupContent>
								</ToolGroupRoot>
							);
						case "group-reasoning": {
							const running = part.status.type === "running";
							return (
								<ReasoningRoot streaming={running}>
									<ReasoningTrigger active={running} />
									<ReasoningContent aria-busy={running}>
										<ReasoningText>{children}</ReasoningText>
									</ReasoningContent>
								</ReasoningRoot>
							);
						}
						default:
							return null;
					}
				}}
			</MessagePrimitive.GroupedParts>
		</div>
	</MessagePrimitive.Root>
);

const IngestScrollToBottom: FC = () => (
	<ThreadPrimitive.ScrollToBottom asChild>
		<TooltipIconButton
			tooltip="Rolar para o fim"
			variant="outline"
			className="absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
		>
			<ArrowDownIcon />
		</TooltipIconButton>
	</ThreadPrimitive.ScrollToBottom>
);

export const IngestThread: FC<IngestThreadProps> = ({ isRunning }) => (
	<ThreadPrimitive.Root
		className="aui-root aui-thread-root bg-background flex h-full min-h-0 flex-col"
		style={{
			["--thread-max-width" as string]: "100%",
		}}
	>
		<div className="border-b px-4 py-2">
			<h2 className="text-sm font-medium">Atividade</h2>
		</div>
		<ThreadPrimitive.Viewport
			autoScroll
			turnAnchor="top"
			className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth"
		>
			<div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
				<AuiIf condition={(s) => s.thread.isEmpty}>
					<p className="text-sm text-muted-foreground">
						Aguardando atualizações do agente…
					</p>
				</AuiIf>

				<div className="mb-4 flex flex-col gap-y-6 empty:hidden">
					<ThreadPrimitive.Messages>
						{() => <IngestThreadMessage />}
					</ThreadPrimitive.Messages>
				</div>

				<ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer bg-background sticky bottom-0 mt-auto flex flex-col gap-2 pb-4">
					<IngestScrollToBottom />
					{isRunning ? (
						<p className="text-xs text-muted-foreground animate-pulse">
							Processando…
						</p>
					) : null}
				</ThreadPrimitive.ViewportFooter>
			</div>
		</ThreadPrimitive.Viewport>
	</ThreadPrimitive.Root>
);
