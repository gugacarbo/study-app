import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IngestPipelineStageViewModel } from "./types";

interface PipelineFlowProps {
	stages: IngestPipelineStageViewModel[];
	activeStageId: string | null;
	onStageClick: (stageId: string) => void;
}

const statusColors: Record<IngestPipelineStageViewModel["status"], string> = {
	done: "border-emerald-500/40 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
	running:
		"border-blue-500/40 bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
	warning:
		"border-amber-500/40 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
	error:
		"border-red-500/40 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
	skipped: "border-border bg-muted text-muted-foreground",
	pending: "border-border bg-muted text-muted-foreground",
};

const indicatorColors: Record<IngestPipelineStageViewModel["status"], string> =
	{
		done: "bg-emerald-500 dark:bg-emerald-400",
		running: "bg-blue-500 dark:bg-blue-400",
		warning: "bg-amber-500 dark:bg-amber-400",
		error: "bg-red-500 dark:bg-red-400",
		skipped: "bg-slate-300 dark:bg-slate-600",
		pending: "bg-slate-400 dark:bg-slate-500",
	};

export function PipelineFlow({
	stages,
	activeStageId,
	onStageClick,
}: PipelineFlowProps) {
	if (stages.length === 0) {
		return (
			<p className="py-4 text-center text-xs text-muted-foreground">
				No flow stages yet
			</p>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-1">
			{stages.map((stage, index) => (
				<div key={stage.stageId} className="flex items-center gap-0.5">
					<Card
						size="sm"
						className={cn(
							"flex cursor-pointer flex-row items-center gap-1.5 rounded-md border px-2 py-1 text-center transition-all",
							statusColors[stage.status],
							activeStageId === stage.stageId &&
								"ring-2 ring-blue-500/40 dark:ring-blue-400/60",
						)}
						onClick={() => onStageClick(stage.stageId)}
					>
						{stage.status === "running" ? (
							<Loader2 className="size-2.5 animate-spin text-blue-600 dark:text-blue-300" />
						) : (
							<div
								className={cn(
									"size-1.5 rounded-full",
									indicatorColors[stage.status],
								)}
							/>
						)}
						<span className="text-[0.625rem] font-medium whitespace-nowrap">
							{stage.label}
						</span>
					</Card>
					{index < stages.length - 1 ? (
						<span className="text-[0.625rem] text-muted-foreground">→</span>
					) : null}
				</div>
			))}
		</div>
	);
}
