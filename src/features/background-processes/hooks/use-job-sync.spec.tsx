import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useJobSync } from "@/features/background-processes/hooks/use-job-sync";
import { JOB_STATUS } from "@/lib/job-kinds";

function SyncProbe({ jobId, onUpdate }: { jobId: string; onUpdate: (state: ReturnType<typeof useJobSync>) => void }) {
	const sync = useJobSync(jobId);
	onUpdate(sync);
	return (
		<div>
			<span data-testid="event-count">{sync.events.length}</span>
			<span data-testid="message-count">{sync.messages.length}</span>
			<span data-testid="status">{sync.status ?? ""}</span>
		</div>
	);
}

describe("useJobSync", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("replays full events on mount even when React Query cache is empty", async () => {
		const jobResponse = {
			status: JOB_STATUS.COMPLETED,
			phase: "persisting",
			error: null,
			metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
			events: [
				{
					seq: 1,
					payload: { type: "text", text: "Lendo o arquivo enviado…" },
					createdAt: null,
				},
				{
					seq: 2,
					payload: { type: "text", text: "Extraindo questões com o modelo de IA…" },
					createdAt: null,
				},
			],
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => jobResponse,
		});
		vi.stubGlobal("fetch", fetchMock);

		const client = new QueryClient({
			defaultOptions: {
				queries: {
					staleTime: 1000 * 60 * 5,
					retry: false,
				},
			},
		});

		// Seed stale cache with empty events (reproduces the bug).
		client.setQueryData(["job-sync", "job-1"], {
			...jobResponse,
			events: [],
		});

		const { getByTestId } = render(
			<QueryClientProvider client={client}>
				<SyncProbe jobId="job-1" onUpdate={() => undefined} />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(getByTestId("event-count").textContent).toBe("2");
			expect(getByTestId("message-count").textContent).toBe("2");
			expect(getByTestId("status").textContent).toBe(JOB_STATUS.COMPLETED);
		});

		expect(fetchMock).toHaveBeenCalled();
		const replayUrl = fetchMock.mock.calls.find(
			(call) => String(call[0]).includes("/events") && !String(call[0]).includes("after="),
		);
		expect(replayUrl).toBeDefined();
	});

	it("rebuilds the thread from a full replay instead of keeping stale partial stream state", async () => {
		const partialResponse = {
			status: JOB_STATUS.RUNNING,
			phase: "extracting",
			error: null,
			metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
			events: [
				{
					seq: 2,
					payload: {
						type: "tool-result",
						messageId: "ingest-step-1",
						toolCallId: "tc-1",
						result: { ok: true, index: 1 },
					},
					createdAt: null,
				},
			],
		};
		const fullResponse = {
			status: JOB_STATUS.RUNNING,
			phase: "extracting",
			error: null,
			metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
			events: [
				{
					seq: 1,
					payload: {
						type: "tool-call",
						messageId: "ingest-step-1",
						toolCallId: "tc-1",
						toolName: "submit_question",
						argsText: JSON.stringify({
							question: "Capital de Santa Catarina?",
							topic: "Geografia",
							options: [],
							answers: ["A"],
						}),
						state: "running",
					},
					createdAt: null,
				},
				{
					seq: 2,
					payload: {
						type: "tool-result",
						messageId: "ingest-step-1",
						toolCallId: "tc-1",
						result: { ok: true, index: 1 },
					},
					createdAt: null,
				},
			],
		};
		let callCount = 0;
		const fetchMock = vi.fn().mockImplementation(async () => {
			callCount += 1;
			return {
				ok: true,
				json: async () => (callCount >= 3 ? fullResponse : partialResponse),
			};
		});
		vi.stubGlobal("fetch", fetchMock);

		const client = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});

		let latestSync: ReturnType<typeof useJobSync> | null = null;
		const getLatestSync = (): ReturnType<typeof useJobSync> => {
			if (latestSync === null) {
				throw new Error("Expected sync state to be available");
			}
			return latestSync;
		};

		render(
			<QueryClientProvider client={client}>
				<SyncProbe
					jobId="job-1"
					onUpdate={(state) => {
						latestSync = state;
					}}
				/>
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(latestSync?.lastSeq).toBe(2);
		});
		expect(getLatestSync().messages).toHaveLength(0);

		await act(async () => {
			await getLatestSync().refetchFromStart();
		});

		await waitFor(() => {
			const message = latestSync?.messages[0];
			expect(message?.id).toBe("ingest-step-1");
			expect(Array.isArray(message?.content)).toBe(true);
		});

		const firstMessage = getLatestSync().messages[0];
		const toolCallPart = Array.isArray(firstMessage?.content)
			? firstMessage.content.find(
					(
						part: { type: string; toolName?: string; result?: unknown },
					) => part.type === "tool-call",
				)
			: undefined;

		expect(toolCallPart).toMatchObject({
			type: "tool-call",
			toolName: "submit_question",
			result: { ok: true, index: 1 },
		});
	});
});
