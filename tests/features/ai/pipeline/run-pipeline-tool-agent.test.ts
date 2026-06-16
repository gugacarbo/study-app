import { stepCountIs } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";

const { runToolAgentStreamMock } = vi.hoisted(() => ({
	runToolAgentStreamMock: vi.fn(),
}));

vi.mock("@/features/ai/core/tool-agent-run", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@/features/ai/core/tool-agent-run")>();
	return {
		...original,
		runToolAgentStream: runToolAgentStreamMock,
	};
});

const providerConfig = {
	model: "test-model",
	baseUrl: "https://example.com",
	apiKey: "test-key",
};

const run: AgentRunDescriptor = {
	stageId: "improve-questions",
	agentRunId: "improve-questions-1",
	label: "Improve Question Q1",
};

function createEmitCollector() {
	const events: Array<Omit<AgentRunDataPart, "timestamp">> = [];
	const emit = vi.fn((event: Omit<AgentRunDataPart, "timestamp">) => {
		events.push(event);
	});
	return { emit, events };
}

function baseParams(overrides: Partial<Parameters<typeof runPipelineToolAgent>[0]> = {}) {
	const { emit } = createEmitCollector();
	return {
		params: {
			scope: "improve-questions",
			stageId: "improve-questions",
			config: providerConfig,
			run,
			emit,
			systemPrompt: "Improve this question.",
			messages: [{ role: "user" as const, content: "Fix option B." }],
			tools: {},
			stopWhen: stepCountIs(3),
			isSuccess: ({ streamState }: { streamState: { rawText: string } }) =>
				streamState.rawText.length > 0,
			...overrides,
		},
		emit,
	};
}

describe("runPipelineToolAgent", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("emits pending, running, token, and done lifecycle events on success", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: false },
			isSuccess: ({ streamState }: { streamState: { rawText: string } }) =>
				streamState.rawText.length > 0,
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.handlers.onTextDelta?.("Hello");
			streamParams.streamState.rawText = "Hello";
			return streamParams.streamState;
		});

		const result = await runPipelineToolAgent(params);

		expect(result.success).toBe(true);
		expect(result.rawText).toBe("Hello");
		expect(emit.mock.calls.map(([event]) => event.eventType)).toEqual([
			"lifecycle",
			"lifecycle",
			"token",
			"lifecycle",
		]);
		expect(emit.mock.calls[0]?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "pending",
			systemPrompt: "Improve this question.",
			userPrompt: "Fix option B.",
		});
		expect(emit.mock.calls[1]?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "running",
		});
		expect(emit.mock.calls[2]?.[0]).toMatchObject({
			eventType: "token",
			rawText: "Hello",
		});
		expect(emit.mock.calls[3]?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "done",
		});
	});

	it("forwards tool-call and tool-result events through emit", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: false },
			isSuccess: () => true,
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.handlers.onToolCall?.({
				toolCallId: "tc-42",
				name: "update_question_options",
				arguments: '{"id":1}',
				input: { id: 1 },
				state: "input-complete",
			});
			streamParams.handlers.onToolResult?.({
				toolCallId: "tc-42",
				content: { ok: true },
				state: "complete",
			});
			return streamParams.streamState;
		});

		await runPipelineToolAgent(params);

		expect(emit.mock.calls.some(([event]) => event.eventType === "tool-call")).toBe(
			true,
		);
		expect(
			emit.mock.calls.some(([event]) => event.eventType === "tool-result"),
		).toBe(true);
		expect(
			emit.mock.calls.find(([event]) => event.eventType === "tool-call")?.[0],
		).toMatchObject({
			name: "update_question_options",
			meta: { toolCallId: "tc-42" },
		});
	});

	it("returns success false with reason when isSuccess is false", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: false },
			isSuccess: () => false,
			failureReason: () => "No successful tool update.",
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.streamState.rawText = "";
			return streamParams.streamState;
		});

		const result = await runPipelineToolAgent(params);

		expect(result).toMatchObject({
			success: false,
			reason: "No successful tool update.",
			rawText: "",
		});
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "error",
			error: "No successful tool update.",
		});
	});

	it("collects tool failure messages and uses the first as default reason", async () => {
		const { params } = baseParams({
			stageStatus: { enabled: false },
			isSuccess: ({ toolFailureMessages }) => toolFailureMessages.length === 0,
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.handlers.onToolResult?.({
				toolCallId: "tc-1",
				content: { ok: false, error: "Invalid option payload" },
				state: "complete",
			});
			return streamParams.streamState;
		});

		const result = await runPipelineToolAgent(params);

		expect(result.success).toBe(false);
		expect(result.reason).toBe("Invalid option payload");
		expect(result.toolFailureMessages).toEqual(["Invalid option payload"]);
	});

	it("emits lifecycle error and returns success false when the stream throws", async () => {
		const { params, emit } = baseParams({ stageStatus: { enabled: false } });

		runToolAgentStreamMock.mockRejectedValueOnce(
			new Error("AI provider returned error: rate limited"),
		);

		const result = await runPipelineToolAgent(params);

		expect(result).toMatchObject({
			success: false,
			reason: "AI provider returned error: rate limited",
		});
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "error",
			error: "AI provider returned error: rate limited",
		});
	});

	it("emits warning events for recoverable stream errors", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: false },
			isSuccess: () => true,
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.onRecoverableError?.("Dropped chunk after tool call");
			streamParams.streamState.rawText = "done";
			return streamParams.streamState;
		});

		await runPipelineToolAgent(params);

		expect(emit.mock.calls.some(([event]) => event.eventType === "warning")).toBe(
			true,
		);
		expect(
			emit.mock.calls.find(([event]) => event.eventType === "warning")?.[0],
		).toMatchObject({
			warning: "Dropped chunk after tool call",
		});
	});

	it("omits prompts in pending lifecycle for multi-message follow-up runs", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: false },
			messages: [
				{ role: "user", content: "First message" },
				{ role: "assistant", content: "First reply" },
				{ role: "user", content: "Follow-up message" },
			],
			isSuccess: () => true,
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.streamState.rawText = "ok";
			return streamParams.streamState;
		});

		await runPipelineToolAgent(params);

		expect(emit.mock.calls[0]?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "pending",
		});
		expect(emit.mock.calls[0]?.[0]).not.toHaveProperty("systemPrompt");
		expect(emit.mock.calls[0]?.[0]).not.toHaveProperty("userPrompt");
	});

	it("injects stage status tool and appends completion prompt by default", async () => {
		const { params } = baseParams({
			stageStatus: { enabled: true, required: false },
			isSuccess: () => true,
		});

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			expect(streamParams.systemPrompt).toContain(
				"call report_agent_stage_status exactly once",
			);
			expect(streamParams.tools).toHaveProperty("report_agent_stage_status");
			expect(streamParams.stopWhen).toEqual(
				expect.arrayContaining([expect.any(Function)]),
			);
			streamParams.streamState.rawText = "done";
			return streamParams.streamState;
		});

		await runPipelineToolAgent(params);
	});

	it("fails strict mode when report_agent_stage_status is missing", async () => {
		const { params, emit } = baseParams({ isSuccess: () => true });

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.streamState.rawText = "done";
			return streamParams.streamState;
		});

		const result = await runPipelineToolAgent(params);

		expect(result.success).toBe(false);
		expect(result.reason).toBe(
			"Agent finished without calling report_agent_stage_status.",
		);
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "error",
			error: "Agent finished without calling report_agent_stage_status.",
		});
	});

	it("emits resolved lifecycle with stageStatusMessage when stage status is reported", async () => {
		const { params, emit } = baseParams({ isSuccess: () => true });

		runToolAgentStreamMock.mockImplementationOnce(async (streamParams) => {
			streamParams.handlers.onToolCall?.({
				toolCallId: "tc-stage",
				name: "report_agent_stage_status",
				state: "input-complete",
			});
			streamParams.handlers.onToolResult?.({
				toolCallId: "tc-stage",
				content: {
					ok: true,
					status: "success",
					message: "Improvements applied.",
				},
				state: "complete",
			});
			streamParams.streamState.rawText = "done";
			return streamParams.streamState;
		});

		const result = await runPipelineToolAgent(params);

		expect(result.success).toBe(true);
		expect(result.resolvedStageStatus).toEqual({
			status: "done",
			message: "Improvements applied.",
		});
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "done",
			meta: {
				stageStatusMessage: "Improvements applied.",
				reportedStageStatus: "success",
			},
		});
	});
});
