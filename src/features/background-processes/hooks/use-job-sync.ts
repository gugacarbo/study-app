import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	INITIAL_INGEST_PROGRESS,
	type IngestProgressState,
	type MappedThreadMessage,
	mergeJobEvents,
	type PendingToolResultsState,
	type StreamPartsState,
} from "@/features/background-processes/lib/ingest-event-mapper";
import {
	formatSystemInfoLabel,
} from "@/features/background-processes/lib/ingest-event-labels";
import {
	type ImproveMonitorState,
	isImproveQuestionsJobMetadata,
	mergeImproveJobEvents,
} from "@/features/background-processes/lib/improve-event-mapper";
import {
	fetchJobEvents,
	JOB_POLL_INTERVAL_MS,
	type JobEventRecord,
	type JobEventsResponse,
} from "@/features/background-processes/lib/jobs-api";
import {
	type ImproveQuestionsJobMetadata,
	type IngestJobMetadata,
	JOB_STATUS,
	type JobStatus,
} from "@/lib/job-kinds";
import type { JobProcessingState } from "@/lib/job-processing";

const TERMINAL = new Set<JobStatus>([
	JOB_STATUS.COMPLETED,
	JOB_STATUS.FAILED,
	JOB_STATUS.CANCELLED,
]);

export type JobSyncState = {
	status: JobStatus | null;
	phase: string | null;
	error: string | null;
	cancelRequestedAt: string | null;
	cancelledAt: string | null;
	processing: {
		state: JobProcessingState;
		heartbeatAt: string | null;
		leaseExpiresAt: string | null;
		recoveryAttempts: number;
	} | null;
	metadata: IngestJobMetadata | ImproveQuestionsJobMetadata | null;
	messages: MappedThreadMessage[];
	progress: IngestProgressState;
	improve: ImproveMonitorState | null;
	events: JobEventRecord[];
	lastSeq: number;
	isTerminal: boolean;
	streamParts?: StreamPartsState;
	streamFirstSeq?: Map<string, number>;
	pendingToolResults?: PendingToolResultsState;
};

const INITIAL_SYNC_STATE: JobSyncState = {
	status: null,
	phase: null,
	error: null,
	cancelRequestedAt: null,
	cancelledAt: null,
	processing: null,
	metadata: null,
	messages: [],
	progress: INITIAL_INGEST_PROGRESS,
	improve: null,
	events: [],
	lastSeq: 0,
	isTerminal: false,
	streamParts: undefined,
	streamFirstSeq: undefined,
	pendingToolResults: undefined,
};

function createReplayBaseState(
	data: Pick<
		JobEventsResponse,
		| "status"
		| "phase"
		| "error"
		| "cancelRequestedAt"
		| "cancelledAt"
		| "processing"
		| "metadata"
	>,
): JobSyncState {
	return {
		...INITIAL_SYNC_STATE,
		status: data.status,
		phase: data.phase,
		error: data.error,
		cancelRequestedAt: data.cancelRequestedAt,
		cancelledAt: data.cancelledAt,
		processing: data.processing,
		metadata: data.metadata,
		improve: isImproveQuestionsJobMetadata(data.metadata)
			? mergeImproveJobEvents({
					metadata: data.metadata,
					incoming: [],
					isJobTerminal: TERMINAL.has(data.status),
				})
			: null,
		isTerminal: TERMINAL.has(data.status),
	};
}

function buildCancellationSystemMessages(
	cancelRequestedAt: string | null,
	cancelledAt: string | null,
	baseSeq: number,
): MappedThreadMessage[] {
	const messages: MappedThreadMessage[] = [];
	let seq = baseSeq;
	if (cancelRequestedAt) {
		const text =
			formatSystemInfoLabel("cancel-requested", { at: cancelRequestedAt }) ??
			"Cancelamento solicitado";
		messages.push({
			id: "system:cancel-requested",
			role: "system",
			content: text,
			seq: seq++,
		});
	}
	if (cancelledAt) {
		const text =
			formatSystemInfoLabel("cancelled", { at: cancelledAt }) ??
			"Job cancelado";
		messages.push({
			id: "system:cancelled",
			role: "system",
			content: text,
			seq: seq++,
		});
	}
	return messages;
}

function mergeCancellationMessages(
	messages: MappedThreadMessage[],
	cancellationMessages: MappedThreadMessage[],
): MappedThreadMessage[] {
	let next = messages;
	for (const cancelMsg of cancellationMessages) {
		const existingIdx = next.findIndex((m) => m.id === cancelMsg.id);
		if (existingIdx >= 0) {
			next = [
				...next.slice(0, existingIdx),
				cancelMsg,
				...next.slice(existingIdx + 1),
			];
		} else {
			next = [...next, cancelMsg];
		}
	}
	return next;
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
			pendingToolResults: baseState.pendingToolResults,
			isJobTerminal: TERMINAL.has(data.status),
		},
		data.events,
	);

	const cancellationMessages = buildCancellationSystemMessages(
		data.cancelRequestedAt,
		data.cancelledAt,
		merged.lastSeq + 1,
	);
	const messagesWithCancellation = mergeCancellationMessages(
		merged.messages,
		cancellationMessages,
	);

	return {
		status: data.status,
		phase: data.phase,
		error: data.error,
		cancelRequestedAt: data.cancelRequestedAt,
		cancelledAt: data.cancelledAt,
		processing: data.processing,
		metadata: data.metadata,
		messages: messagesWithCancellation,
		progress: merged.progress,
		improve: isImproveQuestionsJobMetadata(data.metadata)
			? mergeImproveJobEvents({
					current: baseState.improve,
					metadata: data.metadata,
					incoming: data.events,
					isJobTerminal: TERMINAL.has(data.status),
				})
			: null,
		events: merged.events,
		lastSeq: merged.lastSeq,
		isTerminal: TERMINAL.has(data.status),
		streamParts: merged.streamParts,
		streamFirstSeq: merged.streamFirstSeq,
		pendingToolResults: merged.pendingToolResults,
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
					streamParts: prev.streamParts,
					streamFirstSeq: prev.streamFirstSeq,
					pendingToolResults: prev.pendingToolResults,
				},
				events,
			);
			lastSeqRef.current = merged.lastSeq;
			return {
				...prev,
				messages: merged.messages,
				progress: merged.progress,
				improve:
					isImproveQuestionsJobMetadata(prev.metadata)
						? mergeImproveJobEvents({
								current: prev.improve,
								metadata: prev.metadata,
								incoming: events,
								isJobTerminal: prev.isTerminal,
							})
						: prev.improve,
				events: merged.events,
				lastSeq: merged.lastSeq,
				streamParts: merged.streamParts,
				streamFirstSeq: merged.streamFirstSeq,
				pendingToolResults: merged.pendingToolResults,
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
