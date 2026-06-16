import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import { runPipelineTextAgent } from "@/features/ai/pipeline/server/run-pipeline-text-agent";

const { streamTextWithCompatibilityFallbackMock } = vi.hoisted(() => ({
	streamTextWithCompatibilityFallbackMock: vi.fn(),
}));

vi.mock("@/features/ai/core/stream-text-compat", () => ({
	streamTextWithCompatibilityFallback: streamTextWithCompatibilityFallbackMock,
}));

const providerConfig = {
	model: "test-model",
	baseUrl: "https://example.com",
	apiKey: "test-key",
};

const run: AgentRunDescriptor = {
	stageId: "connection-test",
	agentRunId: "connection-test-1",
	label: "Connection test",
};

const usage = {
	inputTokens: 12,
	outputTokens: 4,
	totalTokens: 16,
};

function createEmitCollector() {
	const events: Array<Omit<AgentRunDataPart, "timestamp">> = [];
	const emit = vi.fn((event: Omit<AgentRunDataPart, "timestamp">) => {
		events.push(event);
	});
	return { emit, events };
}

function baseParams(
	overrides: Partial<Parameters<typeof runPipelineTextAgent>[0]> = {},
) {
	const { emit } = createEmitCollector();
	return {
		params: {
			scope: "connection-test",
			stageId: "connection-test",
			config: providerConfig,
			run,
			emit,
			systemPrompt: "You are a helpful assistant.",
			userPrompt: "Say ready.",
			...overrides,
		},
		emit,
	};
}

describe("runPipelineTextAgent", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("emits pending, running, token, and done lifecycle events on success", async () => {
		const { params, emit } = baseParams({ stageStatus: { enabled: false } });

		streamTextWithCompatibilityFallbackMock.mockImplementationOnce(
			async ({ onStreamPart }) => {
				onStreamPart?.({ type: "text-delta", text: "Ready" });
				onStreamPart?.({ type: "finish-step", usage });
				return {
					text: "Ready",
					usage,
					usedGenerateTextFallback: false,
				};
			},
		);

		const result = await runPipelineTextAgent(params);

		expect(result).toMatchObject({
			success: true,
			text: "Ready",
			usedGenerateTextFallback: false,
		});
		expect(emit.mock.calls.map(([event]) => event.eventType)).toEqual([
			"lifecycle",
			"lifecycle",
			"token",
			"token",
			"lifecycle",
		]);
		expect(emit.mock.calls[0]?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "pending",
			systemPrompt: "You are a helpful assistant.",
			userPrompt: "Say ready.",
		});
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "done",
		});
	});

	it("backfills streamed text when generateText fallback returns text only", async () => {
		const { params, emit } = baseParams({ stageStatus: { enabled: false } });

		streamTextWithCompatibilityFallbackMock.mockImplementationOnce(async () => ({
			text: "Fallback response",
			usage,
			usedGenerateTextFallback: true,
		}));

		const result = await runPipelineTextAgent(params);

		expect(result).toMatchObject({
			success: true,
			text: "Fallback response",
			usedGenerateTextFallback: true,
		});
		expect(
			emit.mock.calls.some(
				([event]) =>
					event.eventType === "token" && event.rawText === "Fallback response",
			),
		).toBe(true);
	});

	it("returns success false and emits lifecycle error when the stream throws", async () => {
		const { params, emit } = baseParams();

		streamTextWithCompatibilityFallbackMock.mockRejectedValueOnce(
			new Error("provider rate limited"),
		);

		const onRecoverableError = vi.fn();
		const result = await runPipelineTextAgent({
			...params,
			stageStatus: { enabled: false },
			onRecoverableError,
		});

		expect(result).toMatchObject({
			success: false,
			reason: "provider rate limited",
		});
		expect(onRecoverableError).toHaveBeenCalledWith("provider rate limited");
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "error",
			error: "provider rate limited",
		});
	});

	it("omits prompts in pending lifecycle when includePromptsInPending is false", async () => {
		const { params, emit } = baseParams({
			includePromptsInPending: false,
			stageStatus: { enabled: false },
		});

		streamTextWithCompatibilityFallbackMock.mockImplementationOnce(async () => ({
			text: "ok",
			usage,
			usedGenerateTextFallback: false,
		}));

		await runPipelineTextAgent(params);

		expect(emit.mock.calls[0]?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "pending",
		});
		expect(emit.mock.calls[0]?.[0]).not.toHaveProperty("systemPrompt");
		expect(emit.mock.calls[0]?.[0]).not.toHaveProperty("userPrompt");
	});

	it("fails strict mode when report_agent_stage_status is missing", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: true, required: true },
		});

		streamTextWithCompatibilityFallbackMock.mockImplementationOnce(async () => ({
			text: "Ready",
			usage,
			usedGenerateTextFallback: false,
		}));

		const result = await runPipelineTextAgent(params);

		expect(result.success).toBe(false);
		expect(result.reason).toBe(
			"Agent finished without calling report_agent_stage_status.",
		);
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "error",
		});
	});

	it("emits resolved lifecycle when stage status is reported", async () => {
		const { params, emit } = baseParams({
			stageStatus: { enabled: true, required: true },
		});

		streamTextWithCompatibilityFallbackMock.mockImplementationOnce(
			async ({ request, onStreamPart }) => {
				const tools = request.tools as Record<
					string,
					{ execute?: (input: unknown, ctx?: { toolCallId?: string }) => Promise<unknown> }
				>;
				const reportStage = tools.report_agent_stage_status;
				const stageInput = {
					status: "success",
					message: "Connection test passed.",
				};
				const stageOutput = {
					ok: true,
					status: "success",
					message: "Connection test passed.",
				};
				await reportStage?.execute?.(stageInput, { toolCallId: "tc-stage" });
				onStreamPart?.({
					type: "tool-result",
					toolCallId: "tc-stage",
					toolName: "report_agent_stage_status",
					input: stageInput,
					output: stageOutput,
				});
				onStreamPart?.({ type: "text-delta", text: "Ready" });
				return {
					text: "Ready",
					usage,
					usedGenerateTextFallback: false,
				};
			},
		);

		const result = await runPipelineTextAgent(params);

		expect(result.success).toBe(true);
		expect(result.resolvedStageStatus).toEqual({
			status: "done",
			message: "Connection test passed.",
		});
		expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({
			eventType: "lifecycle",
			status: "done",
			meta: {
				stageStatusMessage: "Connection test passed.",
				reportedStageStatus: "success",
			},
		});
	});
});
