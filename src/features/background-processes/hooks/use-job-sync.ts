import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	INITIAL_INGEST_PROGRESS,
	type IngestProgressState,
	type MappedThreadMessage,
	mergeJobEvents,
	type StreamPartsState,
} from "@/features/background-processes/lib/ingest-event-mapper";
import {
	fetchJobEvents,
	JOB_POLL_INTERVAL_MS,
	type JobEventRecord,
	type JobEventsResponse,
} from "@/features/background-processes/lib/jobs-api";
import {
	type IngestJobMetadata,
	JOB_STATUS,
	type JobStatus,
} from "@/lib/job-kinds";

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
	messages: MappedThreadMessage[];
	progress: IngestProgressState;
	events: JobEventRecord[];
	lastSeq: number;
	isTerminal: boolean;
	streamParts?: StreamPartsState;
	streamFirstSeq?: Map<string, number>;
};

const INITIAL_SYNC_STATE: JobSyncState = {
	status: null,
	phase: null,
	error: null,
	metadata: null,
	messages: [],
	progress: INITIAL_INGEST_PROGRESS,
	events: [],
	lastSeq: 0,
	isTerminal: false,
	streamParts: undefined,
	streamFirstSeq: undefined,
};

function createReplayBaseState(
	data: Pick<JobEventsResponse, "status" | "phase" | "error" | "metadata">,
): JobSyncState {
	return {
		...INITIAL_SYNC_STATE,
		status: data.status,
		phase: data.phase,
		error: data.error,
		metadata: data.metadata,
		isTerminal: TERMINAL.has(data.status),
	};
}

function applyJobResponse(
	prev: JobSyncState,
	data: JobEventsResponse,
	options?: { replace?: boolean },
): JobSyncState {
	const baseState = options?.replace ? createReplayBaseState(data) : prev;
	const merged = mergeJobEvents(
		{
			messages: baseState.messages,
			progress: baseState.progress,
			lastSeq: baseState.lastSeq,
			events: baseState.events,
			streamParts: baseState.streamParts,
			streamFirstSeq: baseState.streamFirstSeq,
			isJobTerminal: TERMINAL.has(data.status),
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
		events: merged.events,
		lastSeq: merged.lastSeq,
		isTerminal: TERMINAL.has(data.status),
		streamParts: merged.streamParts,
		streamFirstSeq: merged.streamFirstSeq,
	};
}

export function useJobSync(jobId: string, enabled = true) {
	const queryClient = useQueryClient();
	const lastSeqRef = useRef(0);
	const isTerminalRef = useRef(false);
	const prevJobIdRef = useRef(jobId);
	const [state, setState] = useState<JobSyncState>(INITIAL_SYNC_STATE);

	const mergeResponse = useCallback(
		(data: JobEventsResponse, options?: { replace?: boolean }) => {
		setState((prev) => {
			const next = applyJobResponse(
				options?.replace ? prev : { ...prev, lastSeq: lastSeqRef.current },
				data,
				options,
			);
			lastSeqRef.current = next.lastSeq;
			isTerminalRef.current = next.isTerminal;
			return next;
		});
	},
	[],
	);

	const appendEvents = useCallback((events: JobEventRecord[]) => {
		if (events.length === 0) return;
		setState((prev) => {
			const merged = mergeJobEvents(
				{
					messages: prev.messages,
					progress: prev.progress,
					lastSeq: lastSeqRef.current,
					events: prev.events,
				},
				events,
			);
			lastSeqRef.current = merged.lastSeq;
			return {
				...prev,
				messages: merged.messages,
				progress: merged.progress,
				events: merged.events,
				lastSeq: merged.lastSeq,
				streamParts: merged.streamParts,
				streamFirstSeq: merged.streamFirstSeq,
			};
		});
	}, []);

	const refetchFromStart = useCallback(async () => {
		const data = await fetchJobEvents(jobId, 0);
		mergeResponse(data, { replace: true });
	}, [jobId, mergeResponse]);

	const query = useQuery({
		queryKey: ["job-sync", jobId],
		queryFn: async () => fetchJobEvents(jobId, lastSeqRef.current),
		enabled: enabled && jobId.length > 0,
		staleTime: 0,
		refetchInterval: () =>
			isTerminalRef.current ? false : JOB_POLL_INTERVAL_MS,
	});

	useEffect(() => {
		if (prevJobIdRef.current === jobId) return;
		prevJobIdRef.current = jobId;
		lastSeqRef.current = 0;
		isTerminalRef.current = false;
		setState(INITIAL_SYNC_STATE);
	}, [jobId]);

	useEffect(() => {
		if (!query.data) return;
		mergeResponse(query.data);
	}, [query.data, query.dataUpdatedAt, mergeResponse]);

	// Full replay on mount / job change — bypasses stale React Query cache (global staleTime 5m).
	useEffect(() => {
		queryClient.removeQueries({ queryKey: ["job-sync", jobId] });
		void refetchFromStart();
	}, [jobId, queryClient, refetchFromStart]);

	useEffect(() => {
		if (!state.isTerminal || state.events.length > 0 || query.isLoading) {
			return;
		}
		void refetchFromStart();
	}, [
		state.isTerminal,
		state.events.length,
		query.isLoading,
		refetchFromStart,
	]);

	return {
		...state,
		isLoading: query.isLoading,
		isError: query.isError,
		errorMessage: query.error instanceof Error ? query.error.message : null,
		refetch: query.refetch,
		refetchFromStart,
		appendEvents,
	};
}
