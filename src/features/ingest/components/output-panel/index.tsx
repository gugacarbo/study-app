import { Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
	IngestAgentRunViewModel,
	IngestOutputEntry,
	IngestTokenTotals,
} from "../types";
import { OutputPanelAgentRuns } from "./agent-runs";
import { OutputPanelLogs } from "./logs";

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
				<OutputPanelAgentRuns
					filteredAgents={filteredAgents}
					selectedAgent={selectedAgent}
					onSelectAgent={setSelectedAgent}
				/>
			) : (
				<OutputPanelLogs
					rawStreamText={rawStreamText}
					selectedStageId={selectedStageId}
					selectedStageLabel={selectedStageLabel}
					tokenTotals={tokenTotals}
					rawOutput={rawOutput}
					filteredEntries={filteredEntries}
					filteredAgents={filteredAgents}
				/>
			)}
		</div>
	);
}
