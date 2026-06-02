import { Filter, PanelRightOpen, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeJson } from "@/features/ai/components/chat/message/chat-message-utils";
import { ChatMessage } from "@/features/ai/components/chat/message/chat-message";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@tanstack/ai-client";
import type {
	IngestAgentRunViewModel,
	IngestLogEntry,
	IngestOutputEntry,
	IngestTokenTotals,
} from "./types";

interface OutputPanelProps {
	entries: IngestOutputEntry[];
	rawOutput: string;
	tokenTotals: IngestTokenTotals;
	isRunning: boolean;
	selectedStageId: string | null;
	selectedStageLabel: string | null;
	agents: IngestAgentRunViewModel[];
	logs: IngestLogEntry[];
	onClearFilter: () => void;
}

export function OutputPanel({
	entries,
	rawOutput,
	tokenTotals,
	isRunning,
	selectedStageId,
	selectedStageLabel,
	agents,
	logs,
	onClearFilter,
}: OutputPanelProps) {
	const [mode, setMode] = useState<"treated" | "raw">("treated");
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

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

	const agentLogs = useMemo(
		() =>
			selectedAgentId == null
				? []
				: logs.filter((log) => log.agentId === selectedAgentId),
		[logs, selectedAgentId],
	);

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
						<div className="rounded-md border border-white/10 bg-[#0b1424] p-3">
							<div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-200">
								<Sparkles className="size-3.5 text-sky-300" />
								Review agents
							</div>
							<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
								{filteredAgents.map((agent) => (
									<button
										key={agent.id}
										type="button"
										onClick={() => setSelectedAgentId(agent.id)}
										className="flex min-h-20 flex-col items-start gap-1 rounded-md border border-white/10 bg-[#111b2c] px-3 py-2 text-left transition-colors hover:border-sky-400/40 hover:bg-[#14223a]"
									>
										<div className="flex w-full items-center justify-between gap-2">
											<span className="truncate text-xs font-medium text-slate-100">
												{agent.name}
											</span>
											<Badge
												variant="secondary"
												className={cn(
													"text-[0.625rem]",
													agentStateBadgeClass(agent.state),
												)}
											>
												{agent.state}
											</Badge>
										</div>
										{agent.summary ? (
											<p className="line-clamp-2 text-[0.7rem] text-slate-400">
												{agent.summary}
											</p>
										) : null}
									</button>
								))}
							</div>
						</div>
					) : null}

					<div className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-[#0b1424] p-3">
						{filteredEntries.length === 0 ? (
							<EmptyOutputState
								isRunning={isRunning}
								hasStageFilter={Boolean(selectedStageId)}
							/>
						) : (
							<div className="flex flex-col gap-3">
								{filteredEntries.map((entry) =>
									entry.kind === "message" ? (
										<TranscriptMessage key={entry.id} entry={entry} />
									) : (
										<TranscriptEvent key={entry.id} entry={entry} />
									),
								)}
							</div>
						)}
					</div>

					<AgentDetailDialog
						agent={selectedAgent}
						logs={agentLogs}
						open={selectedAgent != null}
						onOpenChange={(open) => {
							if (!open) setSelectedAgentId(null);
						}}
					/>
				</div>
			) : (
				<pre className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-[#0b1424] p-3 text-[0.7rem] leading-relaxed whitespace-pre-wrap text-slate-200">
					{safeJson({
						stageId: selectedStageId,
						stageLabel: selectedStageLabel,
						tokenTotals,
						rawOutput,
						entries: filteredEntries,
						agents: filteredAgents,
					})}
				</pre>
			)}
		</div>
	);
}

function TranscriptMessage({
	entry,
}: {
	entry: Extract<IngestOutputEntry, { kind: "message" }>;
}) {
	const roleLabel = entry.label ?? defaultRoleLabel(entry.role);

	const uiMessage: UIMessage = {
		id: entry.id,
		role: entry.role,
		parts: [{ type: "text", content: entry.content }],
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="px-1 text-[0.625rem] uppercase tracking-wide text-slate-500">
				{roleLabel}
			</div>
			<div
				className={cn(
					entry.status === "warning" && "rounded-lg border-amber-500/30 bg-amber-500/10",
					entry.status === "error" && "rounded-lg border-red-500/30 bg-red-500/10",
				)}
			>
				<ChatMessage message={uiMessage} />
			</div>
		</div>
	);
}

function TranscriptEvent({
	entry,
}: {
	entry: Extract<IngestOutputEntry, { kind: "event" }>;
}) {
	return (
		<div className="rounded-md border border-dashed border-white/10 bg-[#111b2c] px-3 py-2">
			<div className="flex items-center gap-2 text-xs font-medium text-slate-200">
				<PanelRightOpen className="size-3.5 text-slate-400" />
				{entry.label}
			</div>
			{entry.content ? (
				<p className="mt-1 text-[0.7rem] leading-relaxed text-slate-400">
					{entry.content}
				</p>
			) : null}
		</div>
	);
}

function EmptyOutputState({
	isRunning,
	hasStageFilter,
}: {
	isRunning: boolean;
	hasStageFilter: boolean;
}) {
	return (
		<div className="flex h-full min-h-40 items-center justify-center rounded-md text-[0.7rem] text-slate-500">
			{hasStageFilter
				? "No output for this stage yet"
				: isRunning
					? "Waiting for output..."
					: "No output yet"}
		</div>
	);
}

function AgentDetailDialog({
	agent,
	logs,
	open,
	onOpenChange,
}: {
	agent: IngestAgentRunViewModel | null;
	logs: IngestLogEntry[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[92vh] w-[98vw] max-w-[98vw] flex-col border-white/10 bg-[#0f1a2e] p-6 text-slate-100 sm:h-[90vh] sm:max-w-[1400px]">
				<DialogHeader>
					<DialogTitle>{agent?.name ?? ""}</DialogTitle>
					<DialogDescription className="text-slate-400">
						{agent?.summary ??
							"Inspect prompts, response, and agent state."}
					</DialogDescription>
				</DialogHeader>
				{agent ? (
					<Tabs
						defaultValue="output"
						className="mt-2 flex min-h-0 flex-1 flex-col"
					>
						<TabsList className="w-fit bg-[#0b1424]">
							<TabsTrigger value="output">Output</TabsTrigger>
							<TabsTrigger value="log">Log</TabsTrigger>
						</TabsList>
						<TabsContent
							value="output"
							forceMount
							className="mt-4 min-h-0 flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col"
						>
							<div className="flex flex-col gap-3 pr-1">
								<AgentMessageBubble
									messageRole="system"
									label="System prompt"
									content={agent.systemPrompt}
								/>
								<AgentMessageBubble
									messageRole="user"
									label="User prompt"
									content={agent.userPrompt}
								/>
								<AgentMessageBubble
									messageRole="assistant"
									label="Agent response"
									content={agent.response}
								/>
							</div>
						</TabsContent>
						<TabsContent
							value="log"
							forceMount
							className="mt-4 min-h-0 flex-1 overflow-auto data-[state=active]:block"
						>
							{logs.length === 0 ? (
								<div className="flex h-full min-h-32 items-center justify-center rounded-md border border-white/10 bg-[#0b1424] text-[0.7rem] text-slate-500">
									No logs for this agent
								</div>
							) : (
								<div className="flex min-h-0 flex-1 flex-col gap-1 rounded-md border border-white/10 bg-[#0b1424] p-3">
									{logs.map((log) => (
										<div
											key={log.id}
											className={cn(
												"flex items-start gap-2 whitespace-pre-wrap pr-4",
												logLevelClass(log.level),
											)}
										>
											<span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-slate-500">
												{log.level}
											</span>
											<div className="min-w-0 flex-1">
												<div className="text-[0.7rem]">{log.message}</div>
												{log.timestamp ? (
													<div className="text-[0.625rem] text-slate-500">
														{new Date(log.timestamp).toLocaleTimeString()}
													</div>
												) : null}
											</div>
										</div>
									))}
								</div>
							)}
						</TabsContent>
					</Tabs>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function logLevelClass(level: IngestLogEntry["level"]): string {
	switch (level) {
		case "error":
			return "text-red-300";
		case "warning":
			return "text-amber-300";
		case "debug":
			return "text-slate-400";
		default:
			return "text-slate-200";
	}
}

function AgentMessageBubble({
	messageRole,
	label,
	content,
}: {
	messageRole: "system" | "user" | "assistant";
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

function defaultRoleLabel(role: "system" | "user" | "assistant") {
	switch (role) {
		case "system":
			return "System";
		case "user":
			return "User";
		default:
			return "Assistant";
	}
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
