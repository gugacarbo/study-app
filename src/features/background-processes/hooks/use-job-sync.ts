import {
	INITIAL_INGEST_PROGRESS,
	type MappedAssistantMessage,
	mergeJobEvents,
	type IngestProgressState,
} from "@/features/background-processes/lib/ingest-event-mapper";
import {
	fetchJobEvents,
	type JobEventRecord,
	type JobEventsResponse,
} from "@/features/background-processes/lib/jobs-api";
import { JOB_STATUS, type IngestJobMetadata, type JobStatus } from "@/lib/job-kinds";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

const TERMINAL = new Set<JobStatus>([
	JOB_STATUS.COMPLETED,
	JOB_STATUS.FAILED,
	JOB_STATUS.CANCELLED,
]);

export type JobSyncState = {
	status: JobStatus | null;
	phase: string | null;
	error: string | null;
	metadata: IngestJobMetadata | null;
	messages: MappedAssistantMessage[];
	progress: IngestProgressState;
	lastSeq: number;
	isTerminal: boolean;
};

const INITIAL_SYNC_STATE: JobSyncState = {
	status: null,
	phase: null,
	error: null,
	metadata: null,
	messages: [],
	progress: INITIAL_INGEST_PROGRESS,
	lastSeq: 0,
	isTerminal: false,
};

function applyJobResponse(
	prev: JobSyncState,
	data: JobEventsResponse,
): JobSyncState {
	const merged = mergeJobEvents(
		{
			messages: prev.messages,
			progress: prev.progress,
			lastSeq: prev.lastSeq,
		},
		data.events,
	);

	return {
		status: data.status,
		phase: data.phase,
		error: data.error,
		metadata: data.metadata,
		messages: merged.messages,
		progress: merged.progress,
		lastSeq: merged.lastSeq,
		isTerminal: TERMINAL.has(data.status),
	};
}

export function useJobSync(jobId: string, enabled = true) {
	const lastSeqRef = useRef(0);
	const [state, setState] = useState<JobSyncState>(INITIAL_SYNC_STATE);

	const mergeResponse = useCallback((data: JobEventsResponse) => {
		setState((prev) => {
			const next = applyJobResponse(
				{ ...prev, lastSeq: lastSeqRef.current },
				data,
			);
			lastSeqRef.current = next.lastSeq;
			return next;
		});
	}, []);

	const appendEvents = useCallback((events: JobEventRecord[]) => {
		if (events.length === 0) return;
		setState((prev) => {
			const merged = mergeJobEvents(
				{
					messages: prev.messages,
					progress: prev.progress,
					lastSeq: lastSeqRef.current,
				},
				events,
			);
			lastSeqRef.current = merged.lastSeq;
			return {
				...prev,
				messages: merged.messages,
				progress: merged.progress,
				lastSeq: merged.lastSeq,
			};
		});
	}, []);

	const query = useQuery({
		queryKey: ["job-sync", jobId],
		queryFn: async () => fetchJobEvents(jobId, lastSeqRef.current),
		enabled: enabled && jobId.length > 0,
		refetchInterval: (queryState) => {
			const status = queryState.state.data?.status;
			if (status && TERMINAL.has(status)) return false;
			return 1500;
		},
	});

	useEffect(() => {
		if (!query.data) return;
		mergeResponse(query.data);
	}, [query.data, mergeResponse]);

	useEffect(() => {
		lastSeqRef.current = 0;
		setState(INITIAL_SYNC_STATE);
	}, [jobId]);

	return {
		...state,
		isLoading: query.isLoading,
		isError: query.isError,
		errorMessage: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
		appendEvents,
	};
}
