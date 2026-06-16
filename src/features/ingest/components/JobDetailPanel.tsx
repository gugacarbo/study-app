import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineLogsPanel } from "@/features/ai/pipeline/ui";
import { OutputPanel } from "./output-panel";
import { PipelineFlow } from "./PipelineFlow";
import type { IngestJobViewModel } from "./types";

interface JobDetailPanelProps {
	job: IngestJobViewModel;
	activeTab: "output" | "process";
	selectedStageId: string | null;
	onTabChange: (tab: "output" | "process") => void;
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
		<Card
			size="sm"
			className="flex h-full min-h-0 flex-1 flex-col overflow-hidden shadow-sm"
		>
			<CardHeader className="border-b pb-3">
				<CardTitle className="flex items-center gap-2 font-semibold">
					<span className="truncate">{job.fileName}</span>
					<StatusBadge status={job.status} />
					<Badge variant="secondary" className="text-[0.625rem]">
						Review: {job.enableReview ? "on" : "off"}
					</Badge>
					<Badge variant="secondary" className="text-[0.625rem]">
						Explanations: {job.enableExplanations ? "on" : "off"}
					</Badge>
					<Badge variant="secondary" className="text-[0.625rem]">
						Parallel: {job.agentConcurrency}
					</Badge>
				</CardTitle>
				<p className="mt-1 text-[0.625rem] text-muted-foreground">
					Pipeline flow. Click a stage to scope output and process logs.
				</p>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
				<div className="rounded-md border border-border bg-muted p-2.5">
					<PipelineFlow
						stages={job.stages}
						activeStageId={selectedStageId}
						onStageClick={onStageClick}
					/>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(value) => onTabChange(value as "output" | "process")}
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
				>
					<TabsList className="mb-2">
						<TabsTrigger value="output">Output</TabsTrigger>
						<TabsTrigger value="process">Process</TabsTrigger>
					</TabsList>

					<TabsContent
						value="output"
						className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
					>
						<OutputPanel
							jobId={job.id}
							entries={job.outputEntries}
							rawOutput={job.rawOutput}
							rawStreamText={job.rawStreamText}
							tokenTotals={job.tokenTotals}
							stages={job.stages}
							selectedStageId={selectedStageId}
							selectedStageLabel={selectedStage?.label ?? null}
							agents={job.agents}
							onClearFilter={onClearStageFilter}
						/>
					</TabsContent>

					<TabsContent
						value="process"
						className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
					>
						<PipelineLogsPanel
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
