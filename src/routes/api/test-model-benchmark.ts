import { createFileRoute } from "@tanstack/react-router";
import { stepCountIs, type LanguageModelUsage, type ToolSet } from "ai";
import { streamTextWithCompatibilityFallback } from "@/features/ai/core/stream-text-compat";
import { createLlmLogContext } from "@/lib/llm-logging";
import { DBQueries } from "@/db/queries";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import {
	createAiStreamState,
	createToolResultEmitter,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import {
	createAgentRunWriter,
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeJobError,
	writeJobProgress,
	writeJobResult,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import {
	type BenchmarkPhaseId,
	type BenchmarkToolCallRecord,
	validateBenchmarkPhase,
} from "@/features/ai/lib/benchmark-phase-validation";
import {
	buildBenchmarkPerfMetrics,
	buildBenchmarkPhaseMetrics,
	createBenchmarkPhaseTiming,
	finalizeBenchmarkPhaseTiming,
	noteBenchmarkPhaseTextDelta,
	noteBenchmarkPhaseToolCall,
	noteBenchmarkPhaseToolResult,
	type BenchmarkPhaseMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import { extractTokenTotalsFromUsage } from "@/features/ai/lib/token-usage";
import { createBenchmarkTools } from "@/features/ai/tools/benchmark-tools";
import { resolveModelConfigById } from "@/lib/ai-config";
import {
	testModelBenchmarkInputSchema,
	toProviderConfig,
	type ResolvedModelConfig,
} from "@/lib/validation";
import {
	BENCHMARK_PHASES,
	BENCHMARK_STAGE_ID,
	type PhaseDefinition,
} from "./test-model-benchmark/-phases";

type PhaseRunResult = {
	phaseId: BenchmarkPhaseId;
	label: string;
	response: string;
	passed: boolean;
	metrics: BenchmarkPhaseMetrics;
	toolCalls: BenchmarkToolCallRecord[];
	usage?: LanguageModelUsage;
};

type JobTimingTracker = {
	firstTokenAtMs: number | null;
	lastTokenAtMs: number | null;
	generationEndedAtMs: number | null;
	totalCompletionTokens: number;
};

async function runBenchmarkPhase(
	writer: JobUIMessageStreamWriter,
	agentRuns: ReturnType<typeof createAgentRunWriter>,
	modelConfig: ResolvedModelConfig,
	phase: PhaseDefinition,
	abortSignal: AbortSignal,
	jobTiming: JobTimingTracker,
): Promise<PhaseRunResult> {
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Model benchmark canceled");
		}
	};

	const providerConfig = toProviderConfig(modelConfig);
	const run = agentRuns.createRun(BENCHMARK_STAGE_ID, phase.label);
	const streamState = createAiStreamState();
	const phaseTiming = createBenchmarkPhaseTiming(Date.now());
	const toolCalls: BenchmarkToolCallRecord[] = [];
	const toolCallIndexById = new Map<string, number>();
	let responseText = "";
	let usage: LanguageModelUsage | undefined;

	const emitToolResult = createToolResultEmitter((toolResult) => {
		noteBenchmarkPhaseToolResult(phaseTiming, Date.now());
		const index = toolCallIndexById.get(toolResult.toolCallId);
		if (index != null) {
			toolCalls[index] = {
				...toolCalls[index],
				output: toolResult.content,
			};
		}
		agentRuns.toolResult(
			run,
			{
				content: toolResult.content,
				error: toolResult.error,
				state: toolResult.state,
			},
			{ toolCallId: toolResult.toolCallId },
		);
	}, streamState);

	const benchmarkTools = createBenchmarkTools();
	const tools = phase.useTools ? (benchmarkTools as ToolSet) : undefined;

	writeJobProgress(writer, {
		step: `Running ${phase.label}...`,
		percent: phase.progressStart,
		stageId: BENCHMARK_STAGE_ID,
		agentRunId: run.agentRunId,
	});

	agentRuns.lifecycle(run, "pending", {
		systemPrompt: phase.system,
		userPrompt: phase.userMsg,
	});
	agentRuns.lifecycle(run, "running");

	const llmLogContext = createLlmLogContext("model-benchmark", providerConfig, {
		callId: run.agentRunId,
		systemPrompt: phase.system,
		requestSummary: phase.label,
		metadata: { modelId: modelConfig.modelId, phaseId: phase.id },
	});
	const requestOptions = {
		model: getAiModel(providerConfig),
		system: phase.system,
		messages: [{ role: "user" as const, content: phase.userMsg }],
		tools,
		stopWhen: phase.useTools ? stepCountIs(2) : undefined,
		providerOptions: buildProviderOptions(providerConfig),
		abortSignal,
	};

	const generation = await streamTextWithCompatibilityFallback({
		ctx: llmLogContext,
		request: requestOptions,
		onStreamPart: (chunk) => {
			assertNotAborted();
			processAiStreamPart(
				chunk,
				{
					onTextDelta: (delta) => {
						responseText += delta;
						const now = Date.now();
						noteBenchmarkPhaseTextDelta(phaseTiming, now);
						if (jobTiming.firstTokenAtMs == null) {
							jobTiming.firstTokenAtMs = now;
						}
						jobTiming.lastTokenAtMs = now;
						agentRuns.textDelta(run, delta);
					},
					onUsage: (nextUsage) => {
						usage = nextUsage;
						const now = Date.now();
						phaseTiming.generationEndedAtMs = now;
						jobTiming.generationEndedAtMs = now;
						const usageTotals = extractTokenTotalsFromUsage(nextUsage);
						if (usageTotals?.completion) {
							jobTiming.totalCompletionTokens += usageTotals.completion;
						}
						agentRuns.token(run, nextUsage);
					},
					onToolCall: (toolCall) => {
						const now = Date.now();
						noteBenchmarkPhaseToolCall(phaseTiming, now);
						const record: BenchmarkToolCallRecord = {
							name: toolCall.name ?? "unknown",
							input: toolCall.input,
						};
						toolCalls.push(record);
						toolCallIndexById.set(toolCall.toolCallId, toolCalls.length - 1);
						agentRuns.toolCall(
							run,
							{
								name: toolCall.name,
								arguments: toolCall.arguments,
								input: toolCall.input,
								state: toolCall.state,
							},
							{ toolCallId: toolCall.toolCallId },
						);
					},
					onToolResult: emitToolResult,
				},
				streamState,
			);
		},
	});

	if (generation.usedGenerateTextFallback) {
		const now = Date.now();
		if (responseText.trim().length === 0 && generation.text.length > 0) {
			responseText = generation.text;
			noteBenchmarkPhaseTextDelta(phaseTiming, now);
			if (jobTiming.firstTokenAtMs == null) {
				jobTiming.firstTokenAtMs = now;
			}
			jobTiming.lastTokenAtMs = now;
			agentRuns.textDelta(run, generation.text);
		} else if (generation.text.length > 0) {
			responseText = generation.text;
		}

		if (!usage && generation.usage) {
			usage = generation.usage;
			phaseTiming.generationEndedAtMs = now;
			jobTiming.generationEndedAtMs = now;
			const usageTotals = extractTokenTotalsFromUsage(generation.usage);
			if (usageTotals?.completion) {
				jobTiming.totalCompletionTokens += usageTotals.completion;
			}
			agentRuns.token(run, generation.usage);
		}

		if (toolCalls.length === 0 && generation.fallbackResult) {
			for (const step of generation.fallbackResult.steps) {
				for (const toolCall of step.toolCalls) {
					const toolCallId = toolCall.toolCallId;
					const record: BenchmarkToolCallRecord = {
						name: toolCall.toolName,
						input: toolCall.input,
					};
					toolCalls.push(record);
					toolCallIndexById.set(toolCallId, toolCalls.length - 1);
					agentRuns.toolCall(
						run,
						{
							name: toolCall.toolName,
							arguments: JSON.stringify(toolCall.input ?? {}),
							input: toolCall.input,
							state: "input-complete",
						},
						{ toolCallId },
					);
				}

				for (const toolResult of step.toolResults) {
					const toolCallId = toolResult.toolCallId;
					const toolFailed =
						"isError" in toolResult && Boolean(toolResult.isError);
					noteBenchmarkPhaseToolResult(phaseTiming, now);
					const index = toolCallIndexById.get(toolCallId);
					if (index != null) {
						toolCalls[index] = {
							...toolCalls[index],
							output: toolResult.output,
						};
					}
					agentRuns.toolResult(
						run,
						{
							content: toolResult.output,
							error: toolFailed ? "Tool execution failed" : undefined,
							state: toolFailed ? "error" : "complete",
						},
						{ toolCallId },
					);
				}
			}
		}
	}

	const response = generation.text || responseText.trim();
	usage ??= generation.usage;
	const phaseEndedAtMs = Date.now();
	finalizeBenchmarkPhaseTiming(
		phaseTiming,
		phaseEndedAtMs,
		extractTokenTotalsFromUsage(usage)?.completion ?? null,
	);

	const passed = validateBenchmarkPhase(phase.id, response, toolCalls);
	const metrics = {
		...buildBenchmarkPhaseMetrics(
			phase.id,
			phase.label,
			phaseTiming,
			passed,
		),
		agentRunId: run.agentRunId,
	};

	agentRuns.result(run, { response, passed, metrics }, response, {
		benchmarkPhase: metrics,
	});
	agentRuns.lifecycle(run, "done");

	const phaseResult: PhaseRunResult = {
		phaseId: phase.id,
		label: phase.label,
		response,
		passed,
		metrics,
		toolCalls,
		usage,
	};

	writeJobProgress(writer, {
		step: `${phase.label}: ${passed ? "passed" : "failed"}`,
		percent: phase.progressEnd,
		stageId: BENCHMARK_STAGE_ID,
		agentRunId: run.agentRunId,
		meta: {
			phaseMetrics: metrics,
		},
	});

	return phaseResult;
}

async function runModelBenchmark(
	writer: JobUIMessageStreamWriter,
	modelConfig: ResolvedModelConfig,
	abortSignal: AbortSignal,
): Promise<void> {
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Model benchmark canceled");
		}
	};

	const agentRuns = createAgentRunWriter(writer);
	const jobStartedAtMs = Date.now();
	const jobTiming: JobTimingTracker = {
		firstTokenAtMs: null,
		lastTokenAtMs: null,
		generationEndedAtMs: null,
		totalCompletionTokens: 0,
	};
	const phaseResults: PhaseRunResult[] = [];
	let toolCallsTotal = 0;

	writeJobProgress(writer, {
		step: "Validating configuration...",
		percent: 5,
		stageId: BENCHMARK_STAGE_ID,
	});

	assertNotAborted();

	for (const phase of BENCHMARK_PHASES) {
		const phaseResult = await runBenchmarkPhase(
			writer,
			agentRuns,
			modelConfig,
			phase,
			abortSignal,
			jobTiming,
		);
		phaseResults.push(phaseResult);
		toolCallsTotal += phaseResult.toolCalls.length;
	}

	const jobFinishedAtMs = Date.now();
	const phases = phaseResults.map((result) => result.metrics);
	const allPhasesPassed = phases.every((metrics) => metrics.passed === true);
	const benchmarkMetrics = buildBenchmarkPerfMetrics({
		phases,
		jobStartedAtMs,
		jobFinishedAtMs,
		firstTokenAtMs: jobTiming.firstTokenAtMs,
		lastTokenAtMs: jobTiming.lastTokenAtMs,
		generationEndedAtMs: jobTiming.generationEndedAtMs ?? jobFinishedAtMs,
		totalCompletionTokens:
			jobTiming.totalCompletionTokens > 0
				? jobTiming.totalCompletionTokens
				: null,
	});

	writeJobProgress(writer, {
		step: allPhasesPassed ? "All phases passed" : "Benchmark finished",
		percent: 100,
		stageId: BENCHMARK_STAGE_ID,
		meta: {
			benchmarkMetrics,
		},
	});

	const lastResponse =
		phaseResults.at(-1)?.response ??
		phaseResults.map((result) => result.response).join("\n\n");

	writeJobResult(writer, {
		response: lastResponse,
		phases,
		toolCallsTotal,
		allPhasesPassed,
		benchmarkMetrics,
		modelId: modelConfig.modelId,
		model: modelConfig.model,
		providerName: modelConfig.providerName,
	});
}

export const Route = createFileRoute("/api/test-model-benchmark")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payload = await request.json().catch(() => null);
				const parsed = testModelBenchmarkInputSchema.safeParse(payload);
				if (!parsed.success) {
					return new Response("Invalid model selection", { status: 400 });
				}

				const { getDB } = await import("@/server-functions/db");
				const db = await getDB();
				if (!db) {
					return new Response("D1 database not available", { status: 500 });
				}

				const queries = new DBQueries(db);
				let modelConfig: ResolvedModelConfig;
				try {
					modelConfig = await resolveModelConfigById(
						queries,
						parsed.data.modelId,
					);
				} catch (error) {
					return new Response(
						error instanceof Error ? error.message : "AI model not configured",
						{ status: 400 },
					);
				}

				const stream = createJobUIMessageStream({
					execute: async ({ writer }) => {
						try {
							await runModelBenchmark(
								writer,
								modelConfig,
								request.signal,
							);
						} catch (error) {
							writeJobError(writer, {
								message:
									error instanceof Error
										? error.message
										: "Unknown model benchmark error",
								stageId: BENCHMARK_STAGE_ID,
							});
						}
					},
				});

				return createJobUIMessageStreamResponse(stream);
			},
		},
	},
} as never);
