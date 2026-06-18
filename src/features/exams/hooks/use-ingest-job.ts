import { useCallback, useEffect, useRef, useState } from "react";
import {
	INGEST_POLL_INTERVAL_MS,
	createIngestJob,
	fetchIngestJobEvents,
	uploadIngestJobFile,
	type JobEventsResponse,
} from "@/features/exams/lib/ingest-api";
import {
	JOB_STATUS,
	type IngestJobMetadata,
	type JobStatus,
} from "@/lib/job-kinds";

export type IngestUiState =
	| "idle"
	| "uploading"
	| "processing"
	| "done"
	| "failed";

export type IngestJobSnapshot = {
	jobId: string | null;
	examId: string | null;
	uiState: IngestUiState;
	jobStatus: string | null;
	phase: string | null;
	error: string | null;
	metadata: IngestJobMetadata | null;
};

const IDLE_SNAPSHOT: IngestJobSnapshot = {
	jobId: null,
	examId: null,
	uiState: "idle",
	jobStatus: null,
	phase: null,
	error: null,
	metadata: null,
};

const TERMINAL = new Set<JobStatus>([
	JOB_STATUS.COMPLETED,
	JOB_STATUS.FAILED,
	JOB_STATUS.CANCELLED,
]);

function eventsToSnapshot(
	prev: IngestJobSnapshot,
	data: JobEventsResponse,
): IngestJobSnapshot {
	const done = data.status === JOB_STATUS.COMPLETED;
	const failed = TERMINAL.has(data.status) && !done;
	return {
		...prev,
		uiState: done ? "done" : failed ? "failed" : "processing",
		jobStatus: data.status,
		phase: data.phase,
		error: data.error,
		metadata: data.metadata,
	};
}

export function useIngestJob() {
	const [snapshot, setSnapshot] = useState<IngestJobSnapshot>(IDLE_SNAPSHOT);

	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clearPoll = useCallback(() => {
		if (pollTimerRef.current) {
			clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
		}
	}, []);

	useEffect(() => () => clearPoll(), [clearPoll]);

	const pollOnce = useCallback(
		async (jobId: string) => {
			try {
				const data = await fetchIngestJobEvents(jobId);
				setSnapshot((prev) => eventsToSnapshot(prev, data));
				if (TERMINAL.has(data.status)) clearPoll();
			} catch (error) {
				setSnapshot((prev) => ({
					...prev,
					uiState: "failed",
					error: error instanceof Error ? error.message : "Erro desconhecido",
				}));
				clearPoll();
			}
		},
		[clearPoll],
	);

	const startPolling = useCallback(
		(jobId: string) => {
			clearPoll();
			void pollOnce(jobId);
			pollTimerRef.current = setInterval(
				() => void pollOnce(jobId),
				INGEST_POLL_INTERVAL_MS,
			);
		},
		[clearPoll, pollOnce],
	);

	const submit = useCallback(
		async (input: { name: string; file: File; modelId?: string }) => {
			setSnapshot({ ...IDLE_SNAPSHOT, uiState: "uploading" });

			try {
				const { jobId, examId } = await createIngestJob(input);
				setSnapshot((prev) => ({ ...prev, jobId, examId }));
				await uploadIngestJobFile(jobId, input.file);
				setSnapshot((prev) => ({
					...prev,
					uiState: "processing",
					jobStatus: JOB_STATUS.QUEUED,
				}));
				startPolling(jobId);
			} catch (error) {
				setSnapshot((prev) => ({
					...prev,
					uiState: "failed",
					error: error instanceof Error ? error.message : "Erro desconhecido",
				}));
			}
		},
		[startPolling],
	);

	const reset = useCallback(() => {
		clearPoll();
		setSnapshot(IDLE_SNAPSHOT);
	}, [clearPoll]);

	const isBusy =
		snapshot.uiState === "uploading" || snapshot.uiState === "processing";

	return { ...snapshot, submit, reset, isBusy };
}
