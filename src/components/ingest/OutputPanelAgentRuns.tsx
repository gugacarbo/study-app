import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgentRunDetailDialog } from "@/features/ai/components/agent-run-detail-dialog";
import { cn } from "@/lib/utils";
import type { IngestAgentRunViewModel } from "./types";

interface OutputPanelAgentRunsProps {
	filteredAgents: IngestAgentRunViewModel[];
	selectedAgent: IngestAgentRunViewModel | null;
	onSelectAgent: (agent: IngestAgentRunViewModel | null) => void;
}

export function OutputPanelAgentRuns({
	filteredAgents,
	selectedAgent,
	onSelectAgent,
}: OutputPanelAgentRunsProps) {
	if (filteredAgents.length === 0) return null;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
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
							onClick={() => onSelectAgent(agent)}
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
					if (!open) onSelectAgent(null);
				}}
			/>
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
