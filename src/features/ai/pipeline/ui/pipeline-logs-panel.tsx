import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import { cn } from "@/lib/utils";
import { VirtualizedLogLines } from "./virtualized-log-lines";

interface PipelineLogsPanelProps {
	logs: PipelineLogEntry[];
	stepText?: string | null;
	filteredStageId?: string | null;
	filteredStageLabel?: string | null;
	onClearFilter?: () => void;
	compact?: boolean;
	className?: string;
}

export function PipelineLogsPanel({
	logs,
	stepText,
	filteredStageId = null,
	filteredStageLabel = null,
	onClearFilter,
	compact = false,
	className,
}: PipelineLogsPanelProps) {
	const displayLogs = logs.filter(
		(log) =>
			!log.agentRunId && (!filteredStageId || log.stageId === filteredStageId),
	);

	const emptyMessage = filteredStageId
		? "No process logs for this stage yet"
		: "No process logs yet";

	const logContainerClass = cn(
		"min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted leading-relaxed text-slate-200",
		compact ? "p-2 text-[0.65rem]" : "p-3 text-[0.7rem]",
	);

	return (
		<div className={cn("flex min-h-0 flex-1 flex-col", className)}>
			{stepText ? (
				<div
					className={cn(
						"mb-2 shrink-0 truncate rounded-md border border-border bg-background px-2 py-1 text-muted-foreground",
						compact ? "text-[0.65rem]" : "text-xs",
					)}
				>
					{stepText}
				</div>
			) : null}

			{filteredStageLabel && onClearFilter ? (
				<div className="mb-2 flex items-center gap-2">
					<Badge variant="secondary" className="text-[0.625rem]">
						Process: {filteredStageLabel}
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
				<div
					className={cn(
						logContainerClass,
						"text-muted-foreground",
						compact ? "min-h-[6rem]" : "min-h-0",
					)}
				>
					{emptyMessage}
				</div>
			) : (
				<VirtualizedLogLines logs={displayLogs} className={logContainerClass} />
			)}
		</div>
	);
}
