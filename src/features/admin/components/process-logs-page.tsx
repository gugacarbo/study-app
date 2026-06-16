import { useStore } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
	backgroundProcessStore,
	isIngestProcess,
	MAX_RECENT_COMPLETED_PROCESSES,
	parseIngestProcessId,
} from "@/features/background-processes";
import { focusJob } from "@/features/background-processes/kinds/ingest";
import { ingestProcessToJob } from "@/features/background-processes/store/types";
import { JobDetailPanel } from "@/features/ingest/components/JobDetailPanel";
import { QueueList } from "@/features/ingest/components/QueueList";
import { toIngestJobViewModel } from "@/routes/exams.upload/-job-view-model";

function selectFocusedIngestJobId(
	focusedProcessId: string | null,
): string | null {
	if (!focusedProcessId) return null;
	return parseIngestProcessId(focusedProcessId);
}

const noop = () => {};

export function ProcessLogsPage() {
	const { jobs, focusedJobId } = useStore(backgroundProcessStore, (state) => ({
		jobs: state.processes
			.filter(isIngestProcess)
			.map((process) => ingestProcessToJob(process)),
		focusedJobId: selectFocusedIngestJobId(state.focusedProcessId),
	}));

	const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"output" | "process">("process");

	const focusedJob = useMemo(() => {
		if (focusedJobId == null) return null;
		const job = jobs.find((candidate) => candidate.id === focusedJobId) ?? null;
		return job ? toIngestJobViewModel(job) : null;
	}, [focusedJobId, jobs]);

	function handleStageClick(stageId: string) {
		setSelectedStageId((current) => (current === stageId ? null : stageId));
	}

	function handleClearStageFilter() {
		setSelectedStageId(null);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
			<div className="shrink-0">
				<h2 className="text-lg font-semibold">Process Logs</h2>
				<p className="text-xs text-muted-foreground">
					Ingest jobs from local storage. Completed job history is limited to
					the last {MAX_RECENT_COMPLETED_PROCESSES} jobs (
					<code className="rounded bg-muted px-1 py-0.5 text-[0.65rem]">
						MAX_RECENT_COMPLETED_PROCESSES
					</code>
					).
				</p>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden xl:flex-row">
				<div className="flex shrink-0 flex-col overflow-hidden xl:w-55 xl:min-h-0">
					{jobs.length === 0 ? (
						<Card size="sm" className="border-border bg-card">
							<CardContent className="px-4 py-6 text-xs text-muted-foreground">
								No ingest jobs yet. Run an upload at{" "}
								<span className="font-medium text-foreground">
									/exams/upload
								</span>{" "}
								to see process logs here.
							</CardContent>
						</Card>
					) : (
						<QueueList
							jobs={jobs}
							focusedJobId={focusedJobId}
							onFocusJob={focusJob}
							onCancelJob={noop}
							onClearSaved={noop}
							onRemoveJob={noop}
						/>
					)}
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{!focusedJob ? (
						<Card size="sm" className="flex h-full min-h-0 flex-1 flex-col">
							<CardContent className="flex flex-1 items-center justify-center">
								<p className="text-xs text-muted-foreground">
									{jobs.length === 0
										? "Upload a PDF to start tracking ingest logs."
										: "Select a job from the queue."}
								</p>
							</CardContent>
						</Card>
					) : (
						<JobDetailPanel
							job={focusedJob}
							activeTab={activeTab}
							selectedStageId={selectedStageId}
							onTabChange={setActiveTab}
							onStageClick={handleStageClick}
							onClearStageFilter={handleClearStageFilter}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
