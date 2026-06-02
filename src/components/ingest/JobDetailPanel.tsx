import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IngestJob } from "@/stores/ingestStore";
import { LogsPanel } from "./LogsPanel";
import { OutputPanel } from "./OutputPanel";
import { PipelineFlow } from "./PipelineFlow";

interface JobDetailPanelProps {
	job: IngestJob;
	activeTab: "output" | "logs";
	selectedStageId: string | null;
	onTabChange: (tab: "output" | "logs") => void;
	onStageClick: (stageId: string) => void;
	onClearStageFilter: () => void;
}

export function JobDetailPanel({
	job,
	activeTab,
	selectedStageId,
	onTabChange,
	onStageClick,
	onClearStageFilter,
}: JobDetailPanelProps) {
	return (
		<Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-white/10 bg-[#0f1a2e] text-slate-100 shadow-sm">
			<CardHeader className="border-b border-white/10 pb-3">
				<CardTitle className="flex items-center gap-2 text-sm font-semibold">
					<span className="truncate">{job.fileName}</span>
					<StatusBadge status={job.status} />
					<Badge variant="secondary" className="text-[0.625rem]">
						Review: {job.enableReview ? "on" : "off"}
					</Badge>
				</CardTitle>
				<p className="mt-1 text-[0.625rem] text-slate-400">
					Pipeline Flow — click a stage to view its logs
				</p>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
				<div className="rounded-md border border-white/10 bg-[#0b1424] p-2.5">
					<PipelineFlow
						stages={job.flowStages}
						activeStageId={selectedStageId}
						onStageClick={onStageClick}
					/>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(v) => onTabChange(v as "output" | "logs")}
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
				>
					<TabsList className="mb-2 bg-[#0b1424]">
						<TabsTrigger value="output">Output</TabsTrigger>
						<TabsTrigger value="logs">Logs</TabsTrigger>
					</TabsList>

					<TabsContent
						value="output"
						className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
					>
						<OutputPanel
							text={job.streamText}
							tokenTotals={job.tokenTotals}
							isRunning={job.status === "running"}
						/>
					</TabsContent>

					<TabsContent
						value="logs"
						className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
					>
						<LogsPanel
							logs={job.logs}
							stages={job.flowStages}
							filteredStageId={selectedStageId}
							onClearFilter={onClearStageFilter}
						/>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function StatusBadge({ status }: { status: IngestJob["status"] }) {
	const variantMap: Record<
		IngestJob["status"],
		{
			variant: "default" | "secondary" | "destructive" | "outline";
			label: string;
		}
	> = {
		queued: { variant: "secondary", label: "Queued" },
		running: { variant: "default", label: "Running" },
		success: { variant: "outline", label: "Success" },
		error: { variant: "destructive", label: "Error" },
		canceled: { variant: "secondary", label: "Canceled" },
	};
	const { variant, label } = variantMap[status];

	return (
		<Badge variant={variant} className="shrink-0 text-[0.625rem]">
			{label}
		</Badge>
	);
}
