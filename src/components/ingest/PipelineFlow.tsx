import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FlowStage } from "@/stores/ingestStore";

interface PipelineFlowProps {
	stages: FlowStage[];
	activeStageId: string | null;
	onStageClick: (stageId: string) => void;
}

const statusColors: Record<FlowStage["status"], string> = {
	done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
	running: "border-blue-500/40 bg-blue-500/15 text-blue-200",
	warning: "border-amber-500/40 bg-amber-500/10 text-amber-200",
	error: "border-red-500/40 bg-red-500/10 text-red-200",
	pending: "border-slate-600/40 bg-slate-800/30 text-slate-400",
};

const indicatorColors: Record<FlowStage["status"], string> = {
	done: "bg-emerald-400",
	running: "bg-blue-400",
	warning: "bg-amber-400",
	error: "bg-red-400",
	pending: "bg-slate-500",
};

export function PipelineFlow({
	stages,
	activeStageId,
	onStageClick,
}: PipelineFlowProps) {
	if (stages.length === 0) {
		return (
			<p className="py-4 text-center text-xs text-slate-400">
				No flow stages yet
			</p>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-1">
			{stages.map((stage, i) => (
				<div key={stage.stageId} className="flex items-center gap-0.5">
					<Card
						size="sm"
						className={cn(
							"flex cursor-pointer flex-row items-center gap-1.5 rounded-md border px-2 py-1 text-center transition-all",
							statusColors[stage.status],
							activeStageId === stage.stageId && "ring-2 ring-blue-400/60",
						)}
						onClick={() => onStageClick(stage.stageId)}
					>
						{stage.status === "running" ? (
							<Loader2 className="size-2.5 animate-spin text-blue-300" />
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
					{i < stages.length - 1 && (
						<span className="text-[0.625rem] text-slate-500">→</span>
					)}
				</div>
			))}
		</div>
	);
}
