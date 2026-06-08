import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { JobDetailPanel } from "@/features/ingest/components/JobDetailPanel";
import { QueueList } from "@/features/ingest/components/QueueList";
import { UploadCard } from "@/features/ingest/components/UploadCard";
import {
	cancelJob,
	clearSavedIngestJobs,
	focusJob,
	removeJob,
} from "@/features/ingest/store";
import { useUpload } from "./-use-upload";

export { toIngestJobViewModel } from "./-job-view-model";

export const Route = createFileRoute("/exams/upload/")({
	component: IngestPage,
});

function IngestPage() {
	const {
		jobs,
		focusedJobId,
		focusedJob,
		selectedStageId,
		handleUpload,
		handleStageClick,
		handleClearStageFilter,
	} = useUpload();

	const [activeTab, setActiveTab] = useState<"output" | "process">("output");

	return (
		<div data-fullwidth className="flex min-h-0 w-full flex-1 flex-col">
			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-1.5 xl:flex-row">
				<div className="flex shrink-0 flex-col gap-2 overflow-hidden xl:w-55">
					<UploadCard onUpload={handleUpload} />
					<QueueList
						jobs={jobs}
						focusedJobId={focusedJobId}
						onFocusJob={focusJob}
						onCancelJob={cancelJob}
						onClearSaved={clearSavedIngestJobs}
						onRemoveJob={removeJob}
					/>
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{!focusedJob ? (
						<Card size="sm" className="flex h-full min-h-0 flex-1 flex-col">
							<CardContent className="flex flex-1 items-center justify-center">
								<p className="text-xs text-muted-foreground">
									Select a job from the queue
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
