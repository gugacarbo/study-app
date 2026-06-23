import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useJobMonitor } from "@/features/background-processes/hooks/use-job-monitor";
import { JOB_STATUS } from "@/lib/job-kinds";

const useJobSyncMock = vi.fn();
const useJobEventStreamMock = vi.fn();

vi.mock("@/features/background-processes/hooks/use-job-sync", () => ({
	useJobSync: (...args: unknown[]) => useJobSyncMock(...args),
}));

vi.mock("@/features/background-processes/hooks/use-job-event-stream", () => ({
	useJobEventStream: (...args: unknown[]) => useJobEventStreamMock(...args),
}));

function MonitorProbe({
	jobId,
	onUpdate,
}: {
	jobId: string;
	onUpdate: (state: ReturnType<typeof useJobMonitor>) => void;
}) {
	const monitor = useJobMonitor(jobId);
	onUpdate(monitor);
	return null;
}

describe("useJobMonitor", () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it("debounces strong reconciliation while appending stream events", async () => {
		vi.useFakeTimers();

		const appendEvents = vi.fn();
		const refetchFromStart = vi.fn().mockResolvedValue(undefined);
		useJobSyncMock.mockReturnValue({
			status: JOB_STATUS.RUNNING,
			phase: "extracting",
			error: null,
			metadata: null,
			messages: [],
			progress: {
				phase: null,
				questionsSeen: 0,
				extracted: null,
				persisted: null,
				skippedDuplicate: null,
				invalid: null,
				extractedQuestionsPreview: [],
			},
			events: [],
			lastSeq: 12,
			isTerminal: false,
			isLoading: false,
			isError: false,
			errorMessage: null,
			refetch: vi.fn(),
			refetchFromStart,
			appendEvents,
		});

		render(<MonitorProbe jobId="job-1" onUpdate={() => undefined} />);

		expect(useJobEventStreamMock).toHaveBeenLastCalledWith(
			"job-1",
			12,
			true,
			expect.any(Object),
		);

		const handlers = useJobEventStreamMock.mock.lastCall?.[3] as {
			onEvents: (events: Array<{ seq: number; payload: unknown; createdAt: string | null }>) => void;
		};

		act(() => {
			handlers.onEvents([
				{
					seq: 13,
					payload: {
						type: "tool-result",
						messageId: "ingest-step-1",
						toolCallId: "tc-1",
						result: { ok: true, index: 1 },
					},
					createdAt: null,
				},
			]);
			handlers.onEvents([
				{
					seq: 14,
					payload: {
						type: "text",
						messageId: "ingest-step-1",
						text: "Resumo parcial",
					},
					createdAt: null,
				},
			]);
		});

		expect(appendEvents).toHaveBeenCalledTimes(2);
		expect(refetchFromStart).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(249);
		});
		expect(refetchFromStart).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(1);
		});

		expect(refetchFromStart).toHaveBeenCalledTimes(1);
	});
});
