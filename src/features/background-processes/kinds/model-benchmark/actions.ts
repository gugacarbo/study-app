import {
	normalizeTokenTotals,
	type TokenTotals,
} from "@/features/ai/components/token-totals-badge";
import {
	buildBenchmarkPerfMetrics,
	computeTotalRequestMs,
	EMPTY_BENCHMARK_PERF_METRICS,
	type BenchmarkPerfMetrics,
	type BenchmarkPhaseMetrics,
	type StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import { extractTokenTotalsFromUsage } from "@/features/ai/lib/token-usage";
import {
	applyAgentRunPartToMulti,
	createMultiAgentRunState,
	isAbortError,
	rebuildMultiAgentMessages,
	runJobPipeline,
} from "@/features/ai/pipeline/client";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import type {
	AgentRunDataPart,
	JobProgressDataPart,
	JobResultDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import { getProcessById, updateProcess, upsertProcess } from "../../store/store";
import type { ModelBenchmarkBackgroundProcess } from "../../store/types";
import {
	isModelBenchmarkProcess,
	modelBenchmarkProcessId,
} from "../../store/types";
import type { StartModelBenchmarkOptions } from "./types";

const EMPTY_STREAM_METRICS: StreamPerfMetrics = {
	ttftMs: null,
	tokensPerSecond: null,
	totalRequestMs: null,
};

function extractUsageTokenTotals(data: AgentRunDataPart): TokenTotals | null {
	if (data.eventType !== "token" || data.tokens == null) return null;
	if (typeof data.tokens === "string") return null;
	return (
		extractTokenTotalsFromUsage(data.tokens) ??
		normalizeTokenTotals(data.tokens as Partial<TokenTotals>)
	);
}

function mergeTokenTotals(
	current: TokenTotals | null,
	next: TokenTotals,
): TokenTotals {
	if (!current) return next;
	return {
		prompt: current.prompt + next.prompt,
		completion: current.completion + next.completion,
		total: current.total + next.total,
	};
}

function parseBenchmarkPhaseMetrics(value: unknown): BenchmarkPhaseMetrics | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Partial<BenchmarkPhaseMetrics>;
	if (typeof record.phaseId !== "string" || typeof record.label !== "string") {
		return null;
	}
	return record as BenchmarkPhaseMetrics;
}

function parseBenchmarkPerfMetrics(value: unknown): BenchmarkPerfMetrics | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Partial<BenchmarkPerfMetrics>;
	if (!Array.isArray(record.phases) || !record.aggregate) return null;
	return record as BenchmarkPerfMetrics;
}

function finishProcess(
	processId: string,
	patch: Partial<
		Pick<
			ModelBenchmarkBackgroundProcess,
			| "status"
			| "error"
			| "finishedAt"
			| "step"
			| "stepText"
			| "progress"
			| "allPhasesPassed"
		>
	>,
): void {
	updateProcess(processId, (process) => {
		if (!isModelBenchmarkProcess(process)) return process;
		const finishedAt = patch.finishedAt ?? Date.now();
		const totalRequestMs = computeTotalRequestMs(
			process.startedAt ?? finishedAt,
			finishedAt,
		);
		const step = patch.step ?? process.step;
		return {
			...process,
			...patch,
			step,
			stepText: patch.stepText ?? step,
			finishedAt,
			streamMetrics: {
				...process.benchmarkMetrics.aggregate,
				totalRequestMs:
					totalRequestMs ?? process.streamMetrics.totalRequestMs,
			},
		};
	});
}

async function runModelBenchmark(processId: string): Promise<void> {
	const initial = getProcessById(processId);
	if (!initial || !isModelBenchmarkProcess(initial)) return;
	if (initial.status !== "queued") return;

	const abortController = new AbortController();
	registerAbort(processId, abortController);
	const { signal } = abortController;
	const { modelId } = initial;

	const startedAt = Date.now();
	let multiState = createMultiAgentRunState();
	let logs: PipelineLogEntry[] = [];
	let phases: BenchmarkPhaseMetrics[] = [];
	let benchmarkMetrics = EMPTY_BENCHMARK_PERF_METRICS;
	let tokenTotals: TokenTotals | null = null;
	let allPhasesPassed: boolean | null = null;

	updateProcess(processId, (process) => {
		if (!isModelBenchmarkProcess(process)) return process;
		return {
			...process,
			status: "running",
			startedAt,
			progress: 5,
			step: "Starting model benchmark...",
			stepText: "Starting model benchmark...",
			error: null,
			tokenTotals: null,
			logs: [],
			streamMetrics: EMPTY_STREAM_METRICS,
			benchmarkMetrics: EMPTY_BENCHMARK_PERF_METRICS,
			phases: [],
			allPhasesPassed: null,
			messages: [],
		};
	});

	const publishBenchmarkMetrics = (finishedAtMs?: number) => {
		benchmarkMetrics = buildBenchmarkPerfMetrics({
			phases,
			jobStartedAtMs: startedAt,
			jobFinishedAtMs: finishedAtMs ?? Date.now(),
			firstTokenAtMs: null,
			lastTokenAtMs: null,
			generationEndedAtMs: null,
			totalCompletionTokens: tokenTotals?.completion ?? null,
		});
		return benchmarkMetrics;
	};

	const applyProgressPatch = (data: JobProgressDataPart) => {
		const patch: Partial<ModelBenchmarkBackgroundProcess> = {};
		if (data.percent != null) patch.progress = data.percent;
		if (data.step) {
			patch.step = data.step;
			patch.stepText = data.step;
		}

		const phaseMetrics = parseBenchmarkPhaseMetrics(data.meta?.phaseMetrics);
		if (phaseMetrics) {
			const enrichedPhaseMetrics = data.agentRunId
				? { ...phaseMetrics, agentRunId: data.agentRunId }
				: phaseMetrics;
			const nextPhases = [...phases];
			const index = nextPhases.findIndex(
				(candidate) => candidate.phaseId === enrichedPhaseMetrics.phaseId,
			);
			if (index === -1) {
				nextPhases.push(enrichedPhaseMetrics);
			} else {
				nextPhases[index] = enrichedPhaseMetrics;
			}
			phases = nextPhases;
			patch.phases = nextPhases;
		}

		const nextBenchmarkMetrics = parseBenchmarkPerfMetrics(
			data.meta?.benchmarkMetrics,
		);
		if (nextBenchmarkMetrics) {
			benchmarkMetrics = nextBenchmarkMetrics;
			patch.benchmarkMetrics = nextBenchmarkMetrics;
			patch.streamMetrics = nextBenchmarkMetrics.aggregate;
		}

		if (Object.keys(patch).length === 0) return;

		updateProcess(processId, (process) => {
			if (!isModelBenchmarkProcess(process)) return process;
			return { ...process, ...patch };
		});
	};

	try {
		await runJobPipeline({
			request: {
				url: "/api/test-model-benchmark",
				init: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ modelId }),
				},
				signal,
			},
			handlers: {
				onProgress: (_ctx, data) => {
					applyProgressPatch(data);
				},
				onLog: (entry) => {
					logs = [...logs, entry];
					updateProcess(processId, (process) => {
						if (!isModelBenchmarkProcess(process)) return process;
						return { ...process, logs };
					});
				},
				onAgentRun: (_ctx, data) => {
					multiState = applyAgentRunPartToMulti(multiState, data);

					const nextTokenTotals = extractUsageTokenTotals(data);
					const patch: Partial<ModelBenchmarkBackgroundProcess> = {
						messages: rebuildMultiAgentMessages(multiState),
					};

					if (nextTokenTotals) {
						tokenTotals = mergeTokenTotals(tokenTotals, nextTokenTotals);
						patch.tokenTotals = tokenTotals;
						const metrics = publishBenchmarkMetrics();
						patch.benchmarkMetrics = metrics;
						patch.streamMetrics = metrics.aggregate;
					}

					if (data.eventType === "result" && data.meta?.benchmarkPhase) {
						const phaseMetrics = parseBenchmarkPhaseMetrics(
							data.meta.benchmarkPhase,
						);
						if (phaseMetrics) {
							const enrichedPhaseMetrics = {
								...phaseMetrics,
								agentRunId: phaseMetrics.agentRunId ?? data.agentRunId,
							};
							const nextPhases = [...phases];
							const index = nextPhases.findIndex(
								(candidate) =>
									candidate.phaseId === enrichedPhaseMetrics.phaseId,
							);
							if (index === -1) {
								nextPhases.push(enrichedPhaseMetrics);
							} else {
								nextPhases[index] = enrichedPhaseMetrics;
							}
							phases = nextPhases;
							patch.phases = nextPhases;
							const metrics = publishBenchmarkMetrics();
							patch.benchmarkMetrics = metrics;
							patch.streamMetrics = metrics.aggregate;
						}
					}

					updateProcess(processId, (process) => {
						if (!isModelBenchmarkProcess(process)) return process;
						return { ...process, ...patch };
					});
				},
				onResult: (_ctx, data: JobResultDataPart) => {
					const resultBenchmarkMetrics = parseBenchmarkPerfMetrics(
						data.benchmarkMetrics,
					);
					const patch: Partial<ModelBenchmarkBackgroundProcess> = {};
					if (resultBenchmarkMetrics) {
						benchmarkMetrics = resultBenchmarkMetrics;
						patch.benchmarkMetrics = resultBenchmarkMetrics;
						patch.streamMetrics = resultBenchmarkMetrics.aggregate;
					}
					if (Array.isArray(data.phases)) {
						phases = data.phases as BenchmarkPhaseMetrics[];
						patch.phases = phases;
					}
					if (typeof data.allPhasesPassed === "boolean") {
						allPhasesPassed = data.allPhasesPassed;
						patch.allPhasesPassed = data.allPhasesPassed;
					}
					if (Object.keys(patch).length > 0) {
						updateProcess(processId, (process) => {
							if (!isModelBenchmarkProcess(process)) return process;
							return { ...process, ...patch };
						});
					}
				},
			},
		});

		const finishedAtMs = Date.now();
		const finalBenchmarkMetrics =
			parseBenchmarkPerfMetrics(benchmarkMetrics) ??
			publishBenchmarkMetrics(finishedAtMs);
		const passed = allPhasesPassed ?? false;

		updateProcess(processId, (process) => {
			if (!isModelBenchmarkProcess(process)) return process;
			return {
				...process,
				messages: rebuildMultiAgentMessages(multiState),
				benchmarkMetrics: finalBenchmarkMetrics,
				streamMetrics: finalBenchmarkMetrics.aggregate,
				allPhasesPassed: passed,
			};
		});

		finishProcess(processId, {
			status: passed ? "success" : "error",
			progress: 100,
			step: passed ? "All phases passed" : "Benchmark finished with failures",
			stepText: passed
				? "All phases passed"
				: "Benchmark finished with failures",
			allPhasesPassed: passed,
			error: passed ? null : "One or more benchmark phases failed",
		});
	} catch (err) {
		if (isAbortError(err) || signal.aborted) {
			finishProcess(processId, {
				status: "canceled",
				step: "Canceled",
				stepText: "Canceled",
				error: "Model benchmark canceled",
			});
			return;
		}

		const message =
			err instanceof Error ? err.message : "Model benchmark failed";
		finishProcess(processId, {
			status: "error",
			step: "Failed",
			stepText: "Failed",
			error: message,
		});
	} finally {
		unregisterAbort(processId);
		runNextQueued();
	}
}

export function startQueuedModelBenchmark(processId: string): void {
	const process = getProcessById(processId);
	if (!process || !isModelBenchmarkProcess(process)) return;
	if (process.status !== "queued") return;

	void runModelBenchmark(processId);
}

export function startModelBenchmark(
	modelId: number,
	options: StartModelBenchmarkOptions,
): string {
	const processId = modelBenchmarkProcessId(modelId);
	const existing = getModelBenchmarkProcessForModel(modelId);
	if (
		existing &&
		(existing.status === "queued" || existing.status === "running")
	) {
		cancelModelBenchmark(modelId);
	}

	const now = Date.now();
	const process: ModelBenchmarkBackgroundProcess = {
		kind: "model-benchmark",
		id: processId,
		modelId,
		modelDisplayName: options.modelDisplayName,
		providerName: options.providerName ?? null,
		testMode: "benchmark",
		status: "queued",
		createdAt: now,
		startedAt: null,
		finishedAt: null,
		progress: 0,
		step: "Queued",
		stepText: "Queued",
		logs: [],
		error: null,
		tokenTotals: null,
		streamMetrics: EMPTY_STREAM_METRICS,
		benchmarkMetrics: EMPTY_BENCHMARK_PERF_METRICS,
		phases: [],
		allPhasesPassed: null,
		messages: [],
	};

	upsertProcess(process);
	runNextQueued();
	return processId;
}

export function cancelModelBenchmark(modelId: number): void {
	const processId = modelBenchmarkProcessId(modelId);
	const controller = getAbortController(processId);
	if (controller) {
		controller.abort();
		unregisterAbort(processId);
	}

	updateProcess(processId, (process) => {
		if (!isModelBenchmarkProcess(process)) return process;
		if (process.status !== "queued" && process.status !== "running") {
			return process;
		}
		const finishedAt = Date.now();
		const totalRequestMs = computeTotalRequestMs(
			process.startedAt ?? finishedAt,
			finishedAt,
		);
		return {
			...process,
			status: "canceled",
			finishedAt,
			step: "Canceled",
			stepText: "Canceled",
			error: "Model benchmark canceled",
			streamMetrics: {
				...process.streamMetrics,
				totalRequestMs:
					totalRequestMs ?? process.streamMetrics.totalRequestMs,
			},
		};
	});
	runNextQueued();
}

export function getModelBenchmarkProcessForModel(
	modelId: number,
): ModelBenchmarkBackgroundProcess | null {
	const process = getProcessById(modelBenchmarkProcessId(modelId));
	if (!process || !isModelBenchmarkProcess(process)) return null;
	return process;
}
