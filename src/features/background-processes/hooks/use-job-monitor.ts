import { useEffect, useRef, useState } from "react";
import { useJobEventStream } from "@/features/background-processes/hooks/use-job-event-stream";
import { useJobSync } from "@/features/background-processes/hooks/use-job-sync";
import { JOB_STATUS } from "@/lib/job-kinds";

const STREAM_RECONCILE_DEBOUNCE_MS = 250;

export function useJobMonitor(jobId: string) {
	const sync = useJobSync(jobId);
	const appendEventsRef = useRef(sync.appendEvents);
	appendEventsRef.current = sync.appendEvents;
	const refetchFromStartRef = useRef(sync.refetchFromStart);
	refetchFromStartRef.current = sync.refetchFromStart;
	const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [streamAfterSeq, setStreamAfterSeq] = useState<number | null>(null);

	const scheduleReconcile = () => {
		if (reconcileTimerRef.current != null) return;
		reconcileTimerRef.current = setTimeout(() => {
			reconcileTimerRef.current = null;
			void refetchFromStartRef.current();
		}, STREAM_RECONCILE_DEBOUNCE_MS);
	};

	useEffect(() => {
		setStreamAfterSeq(null);
		if (reconcileTimerRef.current != null) {
			clearTimeout(reconcileTimerRef.current);
			reconcileTimerRef.current = null;
		}
	}, [jobId]);

	useEffect(
		() => () => {
			if (reconcileTimerRef.current != null) {
				clearTimeout(reconcileTimerRef.current);
			}
		},
		[],
	);

	useEffect(() => {
		if (sync.isLoading || streamAfterSeq !== null) return;
		setStreamAfterSeq(sync.lastSeq);
	}, [sync.isLoading, sync.lastSeq, streamAfterSeq]);

	const streamEnabled =
		streamAfterSeq !== null &&
		!sync.isTerminal &&
		sync.status != null &&
		sync.status !== JOB_STATUS.AWAITING_UPLOAD;

	useJobEventStream(jobId, streamAfterSeq ?? 0, streamEnabled, {
		onEvents: (events) => {
			appendEventsRef.current(events);
			scheduleReconcile();
		},
		onJobDone: () => {
			if (reconcileTimerRef.current != null) {
				clearTimeout(reconcileTimerRef.current);
				reconcileTimerRef.current = null;
			}
			void refetchFromStartRef.current();
		},
		onError: () => {
			scheduleReconcile();
		},
	});

	const isAwaitingUpload = sync.status === JOB_STATUS.AWAITING_UPLOAD;

	return {
		...sync,
		isAwaitingUpload,
	};
}
