import { useStore } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import { enqueueIngest, ingestStore } from "@/features/ingest/store";
import { toIngestJobViewModel } from "./-job-view-model";

export function useUpload() {
	const { jobs, focusedJobId } = useStore(ingestStore, (state) => ({
		jobs: state.jobs,
		focusedJobId: state.focusedJobId,
	}));

	const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

	const focusedJob = useMemo(() => {
		if (focusedJobId == null) return null;
		const job = jobs.find((candidate) => candidate.id === focusedJobId) ?? null;
		return job ? toIngestJobViewModel(job) : null;
	}, [focusedJobId, jobs]);

	async function handleUpload(
		file: File,
		enableReview: boolean,
		enableExplanations: boolean,
	) {
		const buffer = await file.arrayBuffer();
		enqueueIngest(
			file.name,
			Array.from(new Uint8Array(buffer)),
			enableReview,
			enableExplanations,
		);
	}

	function handleStageClick(stageId: string) {
		setSelectedStageId((current) => (current === stageId ? null : stageId));
	}

	function handleClearStageFilter() {
		setSelectedStageId(null);
	}

	return {
		jobs,
		focusedJobId,
		focusedJob,
		selectedStageId,
		handleUpload,
		handleStageClick,
		handleClearStageFilter,
	};
}
