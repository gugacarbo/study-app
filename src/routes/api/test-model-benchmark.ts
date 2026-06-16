import { createFileRoute } from "@tanstack/react-router";
import { stepCountIs, type LanguageModelUsage, type ToolSet } from "ai";
import { DBQueries } from "@/db/queries";
import type { createAgentRunWriter } from "@/features/ai/core/ui-message-job-stream";
import {
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
import { createAgentEventEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import { createJobApiRoute } from "@/features/ai/pipeline/server/create-job-api-route";
import { JobProgressTracker } from "@/features/ai/pipeline/server/job-progress-tracker";
import { runPipelineTextAgent } from "@/features/ai/pipeline/server/run-pipeline-text-agent";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
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

function createBenchmarkEmit(
	baseEmit: AgentEventEmitter,
	phaseTiming: ReturnType<typeof createBenchmarkPhaseTiming>,
	jobTiming: JobTimingTracker,
	toolCalls: BenchmarkToolCallRecord[],
	toolCallIndexById: Map<string, number>,
): AgentEventEmitter {
	return (event) => {
		const now = Date.now();

		if (event.eventType === "token" && typeof event.rawText === "string") {
			noteBenchmarkPhaseTextDelta(phaseTiming, now);
			if (jobTiming.firstTokenAtMs == null) {
				jobTiming.firstTokenAtMs = now;
			}
			jobTiming.lastTokenAtMs = now;
		}

		if (event.eventType === "token" && event.tokens != null) {
			phaseTiming.generationEndedAtMs = now;
			jobTiming.generationEndedAtMs = now;
			const usageTotals = extractTokenTotalsFromUsage(event.tokens);
			if (usageTotals?.completion) {
				jobTiming.totalCompletionTokens += usageTotals.completion;
			}
		}

		if (event.eventType === "tool-call") {
			noteBenchmarkPhaseToolCall(phaseTiming, now);
			const meta = event.meta as Record<string, unknown> | undefined;
			const toolCallId =
				typeof meta?.toolCallId === "string" ? meta.toolCallId : `tool-${toolCalls.length}`;
			const record: BenchmarkToolCallRecord = {
				name: event.name ?? "unknown",
				input: event.input,
			};
			toolCalls.push(record);
			toolCallIndexById.set(toolCallId, toolCalls.length - 1);
		}

		if (event.eventType === "tool-result") {
			noteBenchmarkPhaseToolResult(phaseTiming, now);
			const meta = event.meta as Record<string, unknown> | undefined;
			const toolCallId =
				typeof meta?.toolCallId === "string" ? meta.toolCallId : undefined;
			if (toolCallId) {
				const index = toolCallIndexById.get(toolCallId);
				if (index != null) {
					toolCalls[index] = {
						...toolCalls[index],
						output: event.content,
					};
				}
			}
		}

		baseEmit(event);
	};
}

async function runBenchmarkPhase(
	writer: JobUIMessageStreamWriter,
	agentRuns: ReturnType<typeof createAgentRunWriter>,
	modelConfig: ResolvedModelConfig,
	phase: PhaseDefinition,
	signal: AbortSignal | undefined,
	jobTiming: JobTimingTracker,
): Promise<PhaseRunResult> {
	const providerConfig = toProviderConfig(modelConfig);
	const run = agentRuns.createRun(BENCHMARK_STAGE_ID, phase.label);
	const phaseTiming = createBenchmarkPhaseTiming(Date.now());
	const toolCalls: BenchmarkToolCallRecord[] = [];
	const toolCallIndexById = new Map<string, number>();
	const baseEmit = createAgentEventEmitter(agentRuns, run);
	const emit = createBenchmarkEmit(
		baseEmit,
		phaseTiming,
		jobTiming,
		toolCalls,
		toolCallIndexById,
	);

	writeJobProgress(writer, {
		step: `Running ${phase.label}...`,
		percent: phase.progressStart,
		stageId: BENCHMARK_STAGE_ID,
		agentRunId: run.agentRunId,
	});

	const benchmarkTools = createBenchmarkTools();
	const tools = phase.useTools ? (benchmarkTools as ToolSet) : undefined;

	const agentParams = {
		scope: "model-benchmark" as const,
		stageId: BENCHMARK_STAGE_ID,
		config: providerConfig,
		run,
		emit,
		systemPrompt: phase.system,
		meta: { modelId: modelConfig.modelId, phaseId: phase.id },
		requestSummary: phase.label,
		abortSignal: signal,
	};

	let response = "";
	let usage: LanguageModelUsage | undefined;

	if (phase.useTools) {
		const result = await runPipelineToolAgent({
			...agentParams,
			messages: [{ role: "user" as const, content: phase.userMsg }],
			tools: tools as ToolSet,
			stopWhen: stepCountIs(2),
			isSuccess: () => true,
		});
		response = result.rawText;
	} else {
		const result = await runPipelineTextAgent({
			...agentParams,
			userPrompt: phase.userMsg,
		});
		response = result.text;
		usage = result.usage;
	}

	const phaseEndedAtMs = Date.now();
	finalizeBenchmarkPhaseTiming(
		phaseTiming,
		phaseEndedAtMs,
		extractTokenTotalsFromUsage(usage)?.completion ?? null,
	);

	const passed = validateBenchmarkPhase(phase.id, response, toolCalls);
	const metrics = {
		...buildBenchmarkPhaseMetrics(phase.id, phase.label, phaseTiming, passed),
		agentRunId: run.agentRunId,
	};

	agentRuns.result(run, { response, passed, metrics }, response, {
		benchmarkPhase: metrics,
	});
	agentRuns.lifecycle(run, "done");

	writeJobProgress(writer, {
		step: `${phase.label}: ${passed ? "passed" : "failed"}`,
		percent: phase.progressEnd,
		stageId: BENCHMARK_STAGE_ID,
		agentRunId: run.agentRunId,
		meta: {
			phaseMetrics: metrics,
		},
	});

	return {
		phaseId: phase.id,
		label: phase.label,
		response,
		passed,
		metrics,
		toolCalls,
		usage,
	};
}

const modelBenchmarkHandler = createJobApiRoute({
	schema: testModelBenchmarkInputSchema,
	logTag: "model-benchmark-handler",
	signal: true,
	run: async ({ writer, data, signal, agentRuns, ctx }) => {
		const { getDB } = await import("@/server-functions/db");
		const db = await getDB();
		if (!db) {
			throw new Error("D1 database not available");
		}

		const queries = new DBQueries(db);
		const modelConfig: ResolvedModelConfig = await resolveModelConfigById(
			queries,
			data.modelId,
		);

		ctx.stageId = BENCHMARK_STAGE_ID;

		const progress = new JobProgressTracker(writer, {
			stageId: BENCHMARK_STAGE_ID,
			signal,
			canceledMessage: "Model benchmark canceled",
		});

		const jobStartedAtMs = Date.now();
		const jobTiming: JobTimingTracker = {
			firstTokenAtMs: null,
			lastTokenAtMs: null,
			generationEndedAtMs: null,
			totalCompletionTokens: 0,
		};
		const phaseResults: PhaseRunResult[] = [];
		let toolCallsTotal = 0;

		progress.step(5, "Validating configuration...");

		for (const phase of BENCHMARK_PHASES) {
			const phaseResult = await runBenchmarkPhase(
				writer,
				agentRuns,
				modelConfig,
				phase,
				signal,
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
	},
});

export const Route = createFileRoute("/api/test-model-benchmark")({
	server: {
		handlers: {
			POST: modelBenchmarkHandler,
		},
	},
} as never);
