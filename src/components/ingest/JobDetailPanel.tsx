import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogsPanel } from "./LogsPanel";
import { OutputPanel } from "./OutputPanel";
import { PipelineFlow } from "./PipelineFlow";
import type { IngestJobViewModel } from "./types";

interface JobDetailPanelProps {
	job: IngestJobViewModel;
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
	const selectedStage =
		selectedStageId == null
			? null
			: (job.stages.find((stage) => stage.stageId === selectedStageId) ?? null);

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
					Pipeline flow. Click a stage to scope output, logs, and review agents.
				</p>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
				<div className="rounded-md border border-white/10 bg-[#0b1424] p-2.5">
					<PipelineFlow
						stages={job.stages}
						activeStageId={selectedStageId}
						onStageClick={onStageClick}
					/>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(value) => onTabChange(value as "output" | "logs")}
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
							entries={job.outputEntries}
							rawOutput={job.rawOutput}
							tokenTotals={job.tokenTotals}
							isRunning={job.status === "running"}
							selectedStageId={selectedStageId}
							selectedStageLabel={selectedStage?.label ?? null}
							agents={job.agents}
							logs={job.logs}
							onClearFilter={onClearStageFilter}
						/>
					</TabsContent>

					<TabsContent
						value="logs"
						className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
					>
						<LogsPanel
							logs={job.logs}
							filteredStageId={selectedStageId}
							filteredStageLabel={selectedStage?.label ?? null}
							onClearFilter={onClearStageFilter}
						/>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function StatusBadge({ status }: { status: IngestJobViewModel["status"] }) {
	const variantMap: Record<
		IngestJobViewModel["status"],
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
