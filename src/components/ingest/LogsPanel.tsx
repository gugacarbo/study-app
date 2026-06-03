import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IngestLogEntry } from "./types";
import { VirtualizedLogLines } from "./VirtualizedLogLines";

interface LogsPanelProps {
	logs: IngestLogEntry[];
	filteredStageId: string | null;
	filteredStageLabel: string | null;
	onClearFilter: () => void;
}

export function LogsPanel({
	logs,
	filteredStageId,
	filteredStageLabel,
	onClearFilter,
}: LogsPanelProps) {
	const displayLogs = filteredStageId
		? logs.filter((log) => log.stageId === filteredStageId)
		: logs;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{filteredStageLabel ? (
				<div className="mb-2 flex items-center gap-2">
					<Badge variant="secondary" className="text-[0.625rem]">
						Logs: {filteredStageLabel}
					</Badge>
					<Button
						type="button"
						variant="ghost"
						size="xs"
						className="h-auto p-0 text-[0.625rem] text-muted-foreground hover:text-foreground"
						onClick={onClearFilter}
					>
						<X className="size-3" />
						Clear filter
					</Button>
				</div>
			) : null}
			{displayLogs.length === 0 ? (
				<div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.7rem] leading-relaxed text-muted-foreground">
					{filteredStageId ? "No logs for this stage yet" : "No logs yet"}
				</div>
			) : (
				<VirtualizedLogLines
					logs={displayLogs}
					className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-[0.7rem] leading-relaxed text-slate-200"
				/>
			)}
		</div>
	);
}
