import { useEffect, useRef, useState } from "react";
import { useJobEventStream } from "@/features/background-processes/hooks/use-job-event-stream";
import { useJobSync } from "@/features/background-processes/hooks/use-job-sync";
import { JOB_STATUS } from "@/lib/job-kinds";

export function useJobMonitor(jobId: string) {
	const sync = useJobSync(jobId);
	const appendEventsRef = useRef(sync.appendEvents);
	appendEventsRef.current = sync.appendEvents;

	const [streamAfterSeq, setStreamAfterSeq] = useState<number | null>(null);

	useEffect(() => {
		setStreamAfterSeq(null);
	}, []);

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
		},
		onJobDone: () => {
			void sync.refetch();
		},
	});

	const isAwaitingUpload = sync.status === JOB_STATUS.AWAITING_UPLOAD;

	return {
		...sync,
		isAwaitingUpload,
	};
}
