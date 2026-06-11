import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type { UIMessage } from "@tanstack/ai-client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeJson } from "@/features/ai/adapters/tanstack-message-adapter";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { useReadOnlyAssistantRuntime } from "@/features/ai/hooks/use-readonly-assistant-runtime";
import { useLiveAgentMessages } from "@/features/ingest/hooks/use-live-agent-messages";
import {
	normalizeTokenTotals,
	type TokenTotals,
	TokenTotalsBadge,
} from "./token-totals-badge";

interface AgentRunDetailDialogProps {
	jobId?: string;
	agentRunId?: string;
	name: string;
	summary?: string;
	systemPrompt?: string;
	userPrompt?: string;
	response?: string;
	messages?: UIMessage[];
	rawData?: unknown;
	tokenTotals?: Partial<TokenTotals> | null;
	isRunning?: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AgentRunDetailDialog({
	jobId,
	agentRunId,
	name,
	systemPrompt,
	userPrompt,
	response,
	messages,
	rawData,
	tokenTotals,
	isRunning = false,
	open,
	onOpenChange,
}: AgentRunDetailDialogProps) {
	const resolvedTokenTotals = normalizeTokenTotals(tokenTotals);
	const [mode, setMode] = useState<"treated" | "raw">("treated");
	const [showDebug, setShowDebug] = useState(false);
	const treatedScrollRef = useRef<HTMLDivElement | null>(null);
	const rawScrollRef = useRef<HTMLPreElement | null>(null);
	const liveMessages = useLiveAgentMessages(jobId, agentRunId, messages);
	const renderedMessages =
		liveMessages && liveMessages.length > 0
			? liveMessages
			: messages && messages.length > 0
				? messages
				: createFallbackMessages({
						systemPrompt,
						userPrompt,
						response,
					});

	const visibleMessages = renderedMessages.filter(
		(message) => message.parts.length > 0,
	);
	const hasRawTab = rawData != null;
	const rawTranscript = buildRawTranscript(visibleMessages, response);
	const runtime = useReadOnlyAssistantRuntime({
		messages: visibleMessages,
		isRunning,
	});

	useEffect(() => {
		if (open) {
			setMode("treated");
			setShowDebug(false);
		}
	}, [open]);

	useEffect(() => {
		if (!open || mode !== "treated") return;
		treatedScrollRef.current?.scrollTo({
			top: treatedScrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [open, mode]);

	useEffect(() => {
		if (!open || mode !== "raw") return;
		rawScrollRef.current?.scrollTo({
			top: rawScrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [open, mode]);

	const treatedContent = (
		<AssistantRuntimeProvider runtime={runtime}>
			<Thread showComposer={false} />
		</AssistantRuntimeProvider>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[92vh] w-[98vw] max-w-[98vw] flex-col border-border bg-card p-6 text-foreground sm:h-[90vh] sm:max-w-350">
				<DialogTitle className="sr-only">{name}</DialogTitle>
				{hasRawTab ? (
					<Tabs
						value={mode}
						onValueChange={(value) => setMode(value as "treated" | "raw")}
						className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
					>
						<div className="flex items-center justify-between gap-2 pr-8">
							<TabsList className="h-8 bg-muted">
								<TabsTrigger
									value="treated"
									className="px-3 text-[0.7rem]"
									onClick={() => setMode("treated")}
								>
									Chat
								</TabsTrigger>
								<TabsTrigger
									value="raw"
									className="px-3 text-[0.7rem]"
									onClick={() => setMode("raw")}
								>
									Raw
								</TabsTrigger>
							</TabsList>
							<div className="flex items-center gap-2">
								{resolvedTokenTotals ? (
									<TokenTotalsBadge tokenTotals={resolvedTokenTotals} />
								) : null}
								{mode === "raw" ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-[0.625rem] text-muted-foreground hover:bg-accent hover:text-foreground"
										onClick={() => setShowDebug((value) => !value)}
									>
										{showDebug ? "Back to raw" : "Debug JSON"}
									</Button>
								) : null}
							</div>
						</div>
						<TabsContent
							value="treated"
							ref={treatedScrollRef}
							className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 data-[state=active]:flex data-[state=active]:flex-col"
						>
							{treatedContent}
						</TabsContent>
						<TabsContent
							value="raw"
							className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 data-[state=active]:flex"
						>
							<pre
								ref={rawScrollRef}
								className="min-h-0 text-[0.7rem] leading-relaxed whitespace-pre-wrap text-foreground/80"
							>
								{showDebug ? safeJson(rawData) : rawTranscript}
							</pre>
						</TabsContent>
					</Tabs>
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
						{resolvedTokenTotals ? (
							<div className="flex justify-end pr-8">
								<TokenTotalsBadge tokenTotals={resolvedTokenTotals} />
							</div>
						) : null}
						<div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3">
							{treatedContent}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function buildRawTranscript(messages: UIMessage[], response?: string): string {
	const sections = messages.map((message) => {
		const lines: string[] = [`[${message.role.toUpperCase()}]`];

		for (const part of message.parts) {
			if (part.type === "text") {
				if (part.content) lines.push(part.content);
				continue;
			}

			if (part.type === "tool-call") {
				lines.push(`TOOL CALL: ${part.name}`);
				if (part.arguments) lines.push(String(part.arguments));
				continue;
			}

			if (part.type === "tool-result") {
				lines.push(`TOOL RESULT (${part.toolCallId}):`);
				if (part.content) lines.push(String(part.content));
				if (part.error) lines.push(`ERROR: ${part.error}`);
			}
		}

		return lines.join("\n");
	});

	if (sections.length > 0) {
		return sections.join("\n\n");
	}

	return response || "Waiting for stream...";
}

function createTextMessage(
	id: string,
	role: UIMessage["role"],
	content?: string,
): UIMessage | null {
	if (!content) return null;
	return { id, role, parts: [{ type: "text" as const, content }] };
}

function createFallbackMessages({
	systemPrompt,
	userPrompt,
	response,
}: Pick<
	AgentRunDetailDialogProps,
	"systemPrompt" | "userPrompt" | "response"
>): UIMessage[] {
	const fallbackMessages: Array<UIMessage | null> = [
		createTextMessage("agent-system", "system", systemPrompt),
		createTextMessage("agent-user", "user", userPrompt),
		createTextMessage("agent-assistant", "assistant", response),
	];

	return fallbackMessages.filter(
		(message): message is UIMessage => message != null,
	);
}
