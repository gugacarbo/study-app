import { consumeModelBenchmarkStream } from "@/features/ai/lib/model-benchmark-stream";
import {
	computeTotalRequestMs,
	EMPTY_BENCHMARK_PERF_METRICS,
	type StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
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

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
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
		return {
			...process,
			...patch,
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
	updateProcess(processId, (process) => {
		if (!isModelBenchmarkProcess(process)) return process;
		return {
			...process,
			status: "running",
			startedAt,
			progress: 5,
			step: "Starting model benchmark...",
			error: null,
			tokenTotals: null,
			streamMetrics: EMPTY_STREAM_METRICS,
			benchmarkMetrics: EMPTY_BENCHMARK_PERF_METRICS,
			phases: [],
			allPhasesPassed: null,
			messages: [],
		};
	});

	try {
		const result = await consumeModelBenchmarkStream(
			modelId,
			{
				onUpdate: (patch) => {
					updateProcess(processId, (process) => {
						if (!isModelBenchmarkProcess(process)) return process;
						const next = { ...process, ...patch };
						if (patch.benchmarkMetrics) {
							next.streamMetrics = patch.benchmarkMetrics.aggregate;
						}
						return next;
					});
				},
			},
			signal,
			{ testStartedAtMs: startedAt },
		);

		finishProcess(processId, {
			status: result.allPhasesPassed ? "success" : "error",
			progress: 100,
			step: result.allPhasesPassed
				? "All phases passed"
				: "Benchmark finished with failures",
			allPhasesPassed: result.allPhasesPassed,
			error: result.allPhasesPassed
				? null
				: "One or more benchmark phases failed",
		});
	} catch (err) {
		if (isAbortError(err) || signal.aborted) {
			finishProcess(processId, {
				status: "canceled",
				step: "Canceled",
				error: "Model benchmark canceled",
			});
			return;
		}

		const message =
			err instanceof Error ? err.message : "Model benchmark failed";
		finishProcess(processId, {
			status: "error",
			step: "Failed",
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
