import type { UIMessage } from "@tanstack/ai-client";
import { Filter, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatMessage } from "@/features/ai/components/chat/message/chat-message";
import { safeJson } from "@/features/ai/components/chat/message/chat-message-utils";
import { SystemMessage } from "@/features/ai/components/chat/message/system-message";
import { UserMessage } from "@/features/ai/components/chat/message/user-message";
import { cn } from "@/lib/utils";
import type {
	IngestAgentRunViewModel,
	IngestOutputEntry,
	IngestTokenTotals,
} from "./types";

interface OutputPanelProps {
	entries: IngestOutputEntry[];
	rawOutput: string;
	rawStreamText: string;
	tokenTotals: IngestTokenTotals;
	selectedStageId: string | null;
	selectedStageLabel: string | null;
	agents: IngestAgentRunViewModel[];
	onClearFilter: () => void;
}

export function OutputPanel({
	entries,
	rawOutput,
	rawStreamText,
	tokenTotals,
	selectedStageId,
	selectedStageLabel,
	agents,
	onClearFilter,
}: OutputPanelProps) {
	const [mode, setMode] = useState<"treated" | "raw">("treated");
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
	const rawPreRef = useRef<HTMLPreElement>(null);

	const filteredEntries = useMemo(
		() =>
			selectedStageId
				? entries.filter((entry) => entry.stageId === selectedStageId)
				: entries,
		[entries, selectedStageId],
	);

	const filteredAgents = useMemo(
		() =>
			selectedStageId
				? agents.filter((agent) => agent.stageId === selectedStageId)
				: agents,
		[agents, selectedStageId],
	);

	const selectedAgent =
		selectedAgentId == null
			? null
			: (filteredAgents.find((agent) => agent.id === selectedAgentId) ?? null);

	useEffect(() => {
		if (mode === "raw" && rawPreRef.current && rawStreamText) {
			rawPreRef.current.scrollTop = rawPreRef.current.scrollHeight;
		}
	}, [mode, rawStreamText]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<Badge variant="secondary" className="text-[0.625rem]">
					Tokens: {tokenTotals.total.toLocaleString()}
				</Badge>
				{selectedStageLabel ? (
					<>
						<Badge variant="secondary" className="text-[0.625rem]">
							<Filter className="mr-1 size-3" />
							Stage: {selectedStageLabel}
						</Badge>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-[0.625rem] text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
							onClick={onClearFilter}
						>
							Clear filter
						</Button>
					</>
				) : null}
				<div className="ml-auto">
					<Tabs
						value={mode}
						onValueChange={(value) => setMode(value as "treated" | "raw")}
					>
						<TabsList className="h-8 bg-[#0b1424]">
							<TabsTrigger value="treated" className="px-3 text-[0.7rem]">
								Treated
							</TabsTrigger>
							<TabsTrigger value="raw" className="px-3 text-[0.7rem]">
								Raw
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</div>

			{mode === "treated" ? (
				<div className="flex min-h-0 flex-1 flex-col gap-3">
					{filteredAgents.length > 0 ? (
						<div className="max-h-52 overflow-y-auto rounded-md border border-white/10 bg-[#0b1424] p-2">
							<div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-200">
								<Sparkles className="size-3.5 text-sky-300" />
								Agents
							</div>
							<div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
								{filteredAgents.map((agent) => (
									<button
										key={agent.id}
										type="button"
										onClick={() => setSelectedAgentId(agent.id)}
										className="flex items-center gap-2 rounded-md border border-white/10 bg-[#111b2c] px-2.5 py-1.5 text-left transition-colors hover:border-sky-400/40 hover:bg-[#14223a]"
									>
										<span className="min-w-0 truncate text-[0.7rem] font-medium text-slate-100">
											{agent.name}
										</span>
										<Badge
											variant="secondary"
											className={cn(
												"shrink-0 text-[0.6rem]",
												agentStateBadgeClass(agent.state),
											)}
										>
											{agent.state}
										</Badge>
									</button>
								))}
							</div>
						</div>
					) : null}

					<AgentDetailDialog
						agent={selectedAgent}
						open={selectedAgent != null}
						onOpenChange={(open) => {
							if (!open) setSelectedAgentId(null);
						}}
					/>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
					<pre
						ref={rawPreRef}
						className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-[#0b1424] p-3 text-[0.7rem] leading-relaxed whitespace-pre-wrap text-slate-200"
					>
						{rawStreamText || "Waiting for stream..."}
					</pre>
					<details className="rounded-md border border-white/10 bg-[#0b1424]">
						<summary className="cursor-pointer px-3 py-1.5 text-[0.65rem] text-slate-400 hover:text-slate-300">
							Debug JSON
						</summary>
						<pre className="max-h-96 overflow-auto border-t border-white/10 p-3 text-[0.65rem] leading-relaxed whitespace-pre-wrap text-slate-300">
							{safeJson({
								stageId: selectedStageId,
								stageLabel: selectedStageLabel,
								tokenTotals,
								rawOutput,
								entries: filteredEntries,
								agents: filteredAgents,
							})}
						</pre>
					</details>
				</div>
			)}
		</div>
	);
}

function AgentDetailDialog({
	agent,
	open,
	onOpenChange,
}: {
	agent: IngestAgentRunViewModel | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[92vh] w-[98vw] max-w-[98vw] flex-col border-white/10 bg-[#0f1a2e] p-6 text-slate-100 sm:h-[90vh] sm:max-w-350">
				<DialogHeader>
					<DialogTitle>{agent?.name ?? ""}</DialogTitle>
					<DialogDescription className="text-slate-400">
						{agent?.summary ?? "Inspect prompts, response, and agent state."}
					</DialogDescription>
				</DialogHeader>
				{agent ? (
					<div className="mt-2 min-h-0 flex-1 overflow-auto">
						<div className="flex flex-col gap-3 pr-1">
							<SystemMessage
								message={{
									id: "agent-system",
									role: "system",
									parts: [{ type: "text", content: agent.systemPrompt ?? "" }],
								}}
							/>
							<UserMessage
								message={{
									id: "agent-user",
									role: "user",
									parts: [{ type: "text", content: agent.userPrompt ?? "" }],
								}}
							/>
							<AgentMessageBubble
								messageRole="assistant"
								label="Agent response"
								content={agent.response}
							/>
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AgentMessageBubble({
	messageRole,
	label,
	content,
}: {
	messageRole: "assistant";
	label: string;
	content?: string;
}) {
	if (!content) return null;

	const uiMessage: UIMessage = {
		id: `agent-${messageRole}`,
		role: messageRole,
		parts: [{ type: "text", content }],
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="px-1 text-[0.625rem] uppercase tracking-wide text-slate-500">
				{label}
			</div>
			<ChatMessage message={uiMessage} />
		</div>
	);
}

function agentStateBadgeClass(state: IngestAgentRunViewModel["state"]): string {
	switch (state) {
		case "success":
			return "bg-emerald-500/15 text-emerald-200";
		case "warning":
			return "bg-amber-500/15 text-amber-200";
		case "error":
			return "bg-red-500/15 text-red-200";
		case "running":
			return "bg-sky-500/15 text-sky-200";
		default:
			return "bg-slate-700 text-slate-300";
	}
}
