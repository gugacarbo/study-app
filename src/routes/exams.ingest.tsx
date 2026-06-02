import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
	cancelJob,
	enqueueIngest,
	focusJob,
	ingestStore,
} from "@/stores/ingestStore";
import { JobDetailPanel } from "@/components/ingest/JobDetailPanel";
import { QueueList } from "@/components/ingest/QueueList";
import { UploadCard } from "@/components/ingest/UploadCard";

export const Route = createFileRoute("/exams/ingest")({
	component: IngestPage,
});

function IngestPage() {
	const { jobs, focusedJobId } = useStore(ingestStore, (s) => ({
		jobs: s.jobs,
		focusedJobId: s.focusedJobId,
	}));

	const [activeTab, setActiveTab] = useState<"output" | "logs">("output");
	const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

	const focusedJob =
		focusedJobId != null
			? (jobs.find((j) => j.id === focusedJobId) ?? null)
			: null;

	async function handleUpload(file: File, enableReview: boolean) {
		const buffer = await file.arrayBuffer();
		enqueueIngest(
			file.name,
			Array.from(new Uint8Array(buffer)),
			enableReview,
		);
	}

	function handleStageClick(stageId: string) {
		setSelectedStageId(stageId);
		setActiveTab("logs");
	}

	function handleClearStageFilter() {
		setSelectedStageId(null);
	}

	return (
		<div
			data-fullwidth
			className="flex min-h-0 flex-1 w-full flex-col"
		>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 md:p-6 xl:flex-row">
				<div className="flex shrink-0 flex-col gap-3 overflow-hidden xl:w-[220px]">
					<UploadCard onUpload={handleUpload} />
					<QueueList
						jobs={jobs}
						focusedJobId={focusedJobId}
						onFocusJob={focusJob}
						onCancelJob={cancelJob}
					/>
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{!focusedJob ? (
						<Card className="flex h-full min-h-0 flex-1 flex-col border-white/15 bg-[#0b1730] text-slate-100">
							<CardContent className="flex flex-1 items-center justify-center text-xs text-slate-400">
								Select a job from the queue
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
