import { useStore } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import {
	backgroundProcessStore,
	isIngestProcess,
	parseIngestProcessId,
} from "@/features/background-processes";
import { ingestProcessToJob } from "@/features/background-processes/store/types";
import { enqueueIngest } from "@/features/background-processes/kinds/ingest";
import { toIngestJobViewModel } from "./-job-view-model";

function selectFocusedIngestJobId(focusedProcessId: string | null): string | null {
	if (!focusedProcessId) return null;
	return parseIngestProcessId(focusedProcessId);
}

export function useUpload() {
	const { jobs, focusedJobId } = useStore(backgroundProcessStore, (state) => ({
		jobs: state.processes
			.filter(isIngestProcess)
			.map((process) => ingestProcessToJob(process)),
		focusedJobId: selectFocusedIngestJobId(state.focusedProcessId),
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
		agentConcurrency: number,
	) {
		const buffer = await file.arrayBuffer();
		enqueueIngest(
			file.name,
			Array.from(new Uint8Array(buffer)),
			enableReview,
			enableExplanations,
			agentConcurrency,
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
