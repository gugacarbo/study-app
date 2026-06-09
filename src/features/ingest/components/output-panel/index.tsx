import { Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
	IngestAgentRunViewModel,
	IngestOutputEntry,
	IngestPipelineStageViewModel,
	IngestTokenTotals,
} from "../types";
import { OutputPanelAgentRuns } from "./agent-runs";

interface OutputPanelProps {
	entries: IngestOutputEntry[];
	rawOutput: string;
	rawStreamText: string;
	tokenTotals: IngestTokenTotals;
	stages: IngestPipelineStageViewModel[];
	selectedStageId: string | null;
	selectedStageLabel: string | null;
	agents: IngestAgentRunViewModel[];
	onClearFilter: () => void;
}

export function OutputPanel({
	tokenTotals,
	selectedStageId,
	selectedStageLabel,
	agents,
	onClearFilter,
}: OutputPanelProps) {
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

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
			</div>
			<OutputPanelAgentRuns
				filteredAgents={filteredAgents}
				selectedAgentId={selectedAgentId}
				onSelectAgentId={setSelectedAgentId}
			/>
		</div>
	);
}
