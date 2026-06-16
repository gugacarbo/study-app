import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeJobStreamMock, runNextQueuedMock } = vi.hoisted(() => ({
	consumeJobStreamMock: vi.fn(),
	runNextQueuedMock: vi.fn(),
}));

vi.mock("@/features/ai/lib/read-job-ui-message-stream", () => ({
	consumeJobStream: consumeJobStreamMock,
}));

vi.mock("@/features/background-processes/store/scheduler", () => ({
	runNextQueued: runNextQueuedMock,
	canStart: vi.fn(),
}));

import {
	getConnectionTestProcessForModel,
	startQueuedConnectionTest,
} from "@/features/background-processes/kinds/connection-test/actions";
import { backgroundProcessStore } from "@/features/background-processes/store/store";
import type { ConnectionTestBackgroundProcess } from "@/features/background-processes/store/types";
import { connectionTestProcessId } from "@/features/background-processes/store/types";

function createQueuedProcess(): ConnectionTestBackgroundProcess {
	return {
		kind: "connection-test",
		id: connectionTestProcessId(42),
		modelId: 42,
		modelDisplayName: "Test Model",
		providerName: "Test Provider",
		status: "queued",
		createdAt: Date.now(),
		startedAt: null,
		finishedAt: null,
		progress: 0,
		step: "Queued",
		stepText: "Queued",
		logs: [],
		prompt: "",
		response: "",
		messages: [],
		error: null,
		tokenTotals: null,
		streamMetrics: {
			ttftMs: null,
			tokensPerSecond: null,
			totalRequestMs: null,
		},
	};
}

function emitConnectionTestStream(
	callbacks: { onData?: (part: { type: string; data: unknown }) => void },
) {
	callbacks.onData?.({
		type: "data-job-progress",
		data: { step: "Generating response", percent: 50 },
	});
	callbacks.onData?.({
		type: "data-process-log",
		data: {
			level: "info",
			message: "Model responded",
			timestamp: 100,
		},
	});
	callbacks.onData?.({
		type: "data-agent-run",
		data: {
			agentRunId: "connection-test-42",
			stageId: "connection-test",
			label: "Connection test",
			eventType: "lifecycle",
			status: "pending",
			timestamp: 1,
			systemPrompt: "sys",
			userPrompt: "ping",
		},
	});
	callbacks.onData?.({
		type: "data-agent-run",
		data: {
			agentRunId: "connection-test-42",
			stageId: "connection-test",
			label: "Connection test",
			eventType: "token",
			timestamp: 2,
			rawText: "pong",
		},
	});
	callbacks.onData?.({
		type: "data-job-result",
		data: { response: "pong" },
	});
}

async function flushAsyncWork() {
	await vi.waitFor(() => {
		expect(consumeJobStreamMock.mock.calls.length).toBeGreaterThan(0);
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("startQueuedConnectionTest", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		backgroundProcessStore.setState(() => ({
			processes: [createQueuedProcess()],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));
	});

	it("marks the process successful after a completed stream", async () => {
		consumeJobStreamMock.mockImplementation(
			async (_request, callbacks?: { onData?: (part: unknown) => void }) => {
				emitConnectionTestStream(callbacks ?? {});
				return { messages: [] };
			},
		);

		startQueuedConnectionTest(connectionTestProcessId(42));
		await flushAsyncWork();

		const process = getConnectionTestProcessForModel(42);
		expect(process?.status).toBe("success");
		expect(process?.progress).toBe(100);
		expect(process?.stepText).toBe("Completed");
		expect(process?.response).toBe("pong");
		expect(process?.logs.some((entry) => entry.message === "Model responded")).toBe(
			true,
		);
		expect(runNextQueuedMock).toHaveBeenCalled();
	});

	it("marks the process as failed when the stream throws", async () => {
		consumeJobStreamMock.mockRejectedValueOnce(new Error("connection refused"));

		startQueuedConnectionTest(connectionTestProcessId(42));
		await flushAsyncWork();

		const process = getConnectionTestProcessForModel(42);
		expect(process?.status).toBe("error");
		expect(process?.error).toBe("connection refused");
		expect(process?.stepText).toBe("Failed");
		expect(runNextQueuedMock).toHaveBeenCalled();
	});
});
