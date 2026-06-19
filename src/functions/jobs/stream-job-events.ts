import { createDb } from "@/db/client";
import { getJobById, listJobEvents } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import { JOB_STATUS } from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export const SSE_POLL_INTERVAL_MS = 500;

const TERMINAL_STATUSES = new Set<string>([
	JOB_STATUS.COMPLETED,
	JOB_STATUS.FAILED,
	JOB_STATUS.CANCELLED,
]);

function parseAfterParam(value: string | null): number {
	if (!value) return 0;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return parsed;
}

function formatSseData(data: unknown): string {
	return `data: ${JSON.stringify(data)}\n\n`;
}

export async function streamJobEventsHandler(
	jobId: string,
	request: Request,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}

	const url = new URL(request.url);
	let lastSeq = parseAfterParam(url.searchParams.get("after"));

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const pushEvents = async (): Promise<boolean> => {
				const events = await listJobEvents(db, jobId, lastSeq);
				for (const event of events) {
					controller.enqueue(
						encoder.encode(
							formatSseData({
								seq: event.seq,
								payload: JSON.parse(event.payload),
								createdAt: event.createdAt,
							}),
						),
					);
					lastSeq = event.seq;
				}

				const currentJob = await getJobById(db, jobId, session.user.id);
				if (!currentJob) {
					return false;
				}

				if (TERMINAL_STATUSES.has(currentJob.status)) {
					controller.enqueue(
						encoder.encode(
							formatSseData({
								type: "job-done",
								status: currentJob.status,
								error: currentJob.error,
							}),
						),
					);
					return false;
				}

				return (
					currentJob.status === JOB_STATUS.RUNNING ||
					currentJob.status === JOB_STATUS.QUEUED
				);
			};

			try {
				let keepPolling = await pushEvents();
				while (keepPolling && !request.signal.aborted) {
					await new Promise((resolve) =>
						setTimeout(resolve, SSE_POLL_INTERVAL_MS),
					);
					if (request.signal.aborted) break;
					keepPolling = await pushEvents();
				}
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
