import { useEffect, useRef } from "react";
import {
	consumeJobEventStream,
	type JobStreamEvent,
} from "@/features/background-processes/lib/job-event-stream";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";

export type JobStreamHandlers = {
	onEvents: (events: JobEventRecord[]) => void;
	onJobDone: (input: { status: string; error: string | null }) => void;
	onError?: (error: Error) => void;
};

export function useJobEventStream(
	jobId: string,
	afterSeq: number,
	enabled: boolean,
	handlers: JobStreamHandlers,
) {
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		if (!enabled || !jobId) return;

		const controller = new AbortController();

		void consumeJobEventStream({
			jobId,
			afterSeq,
			signal: controller.signal,
			onEvent: (event: JobStreamEvent) => {
				if (event.type === "job-done") {
					handlersRef.current.onJobDone({
						status: event.status,
						error: event.error,
					});
					return;
				}

				handlersRef.current.onEvents([
					{
						seq: event.seq,
						payload: event.payload,
						createdAt: event.createdAt,
					},
				]);
			},
			onError: (error) => {
				handlersRef.current.onError?.(error);
			},
		}).catch((error) => {
			if (controller.signal.aborted) return;
			handlersRef.current.onError?.(
				error instanceof Error ? error : new Error("SSE error"),
			);
		});

		return () => controller.abort();
	}, [jobId, afterSeq, enabled]);
}
