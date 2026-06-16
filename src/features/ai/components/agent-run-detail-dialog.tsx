import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { usePipelineAssistantRuntime } from "@/features/ai/pipeline/ui";
import {
	useLiveAgentMessages,
	useLiveAgentRun,
} from "@/features/ingest/hooks/use-live-agent-messages";
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
	const [isCopied, setIsCopied] = useState(false);
	const treatedScrollRef = useRef<HTMLDivElement | null>(null);
	const rawScrollRef = useRef<HTMLPreElement | null>(null);
	const liveAgentRun = useLiveAgentRun(jobId, agentRunId);
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
	const runtime = usePipelineAssistantRuntime({
		messages: visibleMessages,
		isRunning,
		mode: "readonly",
	});

	useEffect(() => {
		if (open) {
			setMode("treated");
			setIsCopied(false);
		}
	}, [open]);

	const debugPayload = buildAgentRunDebugPayload({
		jobId,
		agentRunId,
		name,
		messages: visibleMessages,
		liveAgentRun,
		systemPrompt,
		userPrompt,
		response,
		rawData,
		tokenTotals: resolvedTokenTotals,
	});

	const copyDebugJson = () => {
		if (
			typeof navigator === "undefined" ||
			!navigator.clipboard ||
			isCopied
		) {
			return;
		}

		navigator.clipboard.writeText(safeJson(debugPayload)).then(
			() => {
				setIsCopied(true);
				window.setTimeout(() => setIsCopied(false), 2500);
			},
			() => {},
		);
	};

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
		<StudyAssistantRuntimeProvider runtime={runtime}>
			<Thread showComposer={false} collapsiblePrompts />
		</StudyAssistantRuntimeProvider>
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
										onClick={copyDebugJson}
									>
										{isCopied ? "Copied!" : "Debug JSON"}
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
								{rawTranscript}
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

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

interface AgentRunDebugPayloadInput {
	jobId?: string;
	agentRunId?: string;
	name: string;
	messages: UIMessage[];
	liveAgentRun?: {
		stageId: string;
		label: string;
		status: string;
		systemPrompt: string;
		userPrompt: string;
		outputText: string;
		rawOutput: unknown;
		error: string | null;
		warnings: string[];
		meta?: Record<string, unknown>;
		tokenTotals: { prompt: number; completion: number; total: number };
	};
	systemPrompt?: string;
	userPrompt?: string;
	response?: string;
	rawData?: unknown;
	tokenTotals: TokenTotals | null;
}

function buildAgentRunDebugPayload({
	jobId,
	agentRunId,
	name,
	messages,
	liveAgentRun,
	systemPrompt,
	userPrompt,
	response,
	rawData,
	tokenTotals,
}: AgentRunDebugPayloadInput): Record<string, unknown> {
	if (liveAgentRun) {
		return {
			jobId,
			agentRunId,
			name,
			stageId: liveAgentRun.stageId,
			status: liveAgentRun.status,
			systemPrompt: liveAgentRun.systemPrompt,
			userPrompt: liveAgentRun.userPrompt,
			outputText: liveAgentRun.outputText,
			messages,
			rawOutput: liveAgentRun.rawOutput,
			error: liveAgentRun.error,
			warnings: liveAgentRun.warnings,
			meta: liveAgentRun.meta,
			tokenTotals: tokenTotals ?? liveAgentRun.tokenTotals,
		};
	}

	return {
		jobId,
		agentRunId,
		name,
		systemPrompt,
		userPrompt,
		response,
		messages,
		raw: rawData,
		tokenTotals,
	};
}

function stringifyToolOutput(output: unknown): string {
	if (typeof output === "string") return output;
	try {
		return JSON.stringify(output, null, 2);
	} catch {
		return String(output ?? "");
	}
}

function buildRawTranscript(messages: UIMessage[], response?: string): string {
	const sections = messages.map((message) => {
		const lines: string[] = [`[${message.role.toUpperCase()}]`];

		for (const part of message.parts) {
			if (part.type === "text") {
				if (part.text) lines.push(part.text);
				continue;
			}

			if (part.type === "reasoning") {
				if (part.text) {
					lines.push(`REASONING: ${part.text}`);
				}
				continue;
			}

			if (part.type === "dynamic-tool") {
				lines.push(`TOOL CALL: ${part.toolName}`);
				if (part.input != null) {
					lines.push(stringifyToolOutput(part.input));
				}
				if (
					part.state === "output-available" ||
					part.state === "output-error" ||
					part.output != null
				) {
					lines.push(`TOOL RESULT (${part.toolCallId}):`);
					if (part.output != null) {
						lines.push(stringifyToolOutput(part.output));
					}
					if (part.errorText) lines.push(`ERROR: ${part.errorText}`);
				}
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
	return { id, role, parts: [{ type: "text" as const, text: content }] };
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
