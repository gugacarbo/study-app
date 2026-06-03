import { Filter, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { safeJson } from "@/features/ai/components/chat/message/chat-message-utils";
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
	const [selectedAgent, setSelectedAgent] =
		useState<IngestAgentRunViewModel | null>(null);
	const [showDebug, setShowDebug] = useState(false);
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
							className="h-6 px-2 text-[0.625rem] text-muted-foreground hover:bg-accent hover:text-foreground"
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
						<TabsList className="h-8 bg-muted">
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
						<div className="max-h-52 overflow-y-auto rounded-md border border-border bg-muted p-2">
							<div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80">
								<Sparkles className="size-3.5 text-sky-500 dark:text-sky-300" />
								Agents
							</div>
							<div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
								{filteredAgents.map((agent) => (
									<button
										key={agent.id}
										type="button"
										onClick={() => setSelectedAgent(agent)}
										className="flex items-center gap-2 rounded-md border border-border bg-accent px-2.5 py-1.5 text-left transition-colors hover:border-sky-400/40 hover:bg-accent"
									>
										<span className="min-w-0 truncate text-[0.7rem] font-medium text-foreground">
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

					<AgentRunDetailDialog
						name={selectedAgent?.name ?? ""}
						summary={
							selectedAgent?.summary ??
							"Inspect prompts, response, and agent state."
						}
						systemPrompt={selectedAgent?.systemPrompt}
						userPrompt={selectedAgent?.userPrompt}
						response={selectedAgent?.response}
						open={selectedAgent != null}
						onOpenChange={(open) => {
							if (!open) setSelectedAgent(null);
						}}
					/>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="ml-auto h-6 px-2 text-[0.625rem] text-muted-foreground hover:bg-accent hover:text-foreground"
							onClick={() => setShowDebug((v) => !v)}
						>
							{showDebug ? "Back to raw" : "Debug JSON"}
						</Button>
					</div>
					{showDebug ? (
						<pre className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.65rem] leading-relaxed whitespace-pre-wrap text-foreground/80">
							{safeJson({
								stageId: selectedStageId,
								stageLabel: selectedStageLabel,
								tokenTotals,
								rawOutput,
								entries: filteredEntries,
								agents: filteredAgents,
							})}
						</pre>
					) : (
						<pre
							ref={rawPreRef}
							className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.7rem] leading-relaxed whitespace-pre-wrap text-foreground/80"
						>
							{rawStreamText || "Waiting for stream..."}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}

function agentStateBadgeClass(state: IngestAgentRunViewModel["state"]): string {
	switch (state) {
		case "success":
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
		case "warning":
			return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
		case "error":
			return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
		case "running":
			return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
		default:
			return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
	}
}
