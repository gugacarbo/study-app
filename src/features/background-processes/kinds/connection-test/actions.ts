import {
	normalizeTokenTotals,
	type TokenTotals,
} from "@/features/ai/components/token-totals-badge";
import {
	buildStreamPerfMetrics,
	computeTotalRequestMs,
	type StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import { extractTokenTotalsFromUsage } from "@/features/ai/lib/token-usage";
import {
	createSingleAgentRunHandlers,
	isAbortError,
	runJobPipeline,
} from "@/features/ai/pipeline/client";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import type {
	AgentRunDataPart,
	JobResultDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import {
	getProcessById,
	updateProcess,
	upsertProcess,
} from "../../store/store";
import type { ConnectionTestBackgroundProcess } from "../../store/types";
import {
	connectionTestProcessId,
	isConnectionTestProcess,
} from "../../store/types";
import type { StartConnectionTestOptions } from "./types";

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

function finishProcess(
	processId: string,
	patch: Partial<
		Pick<
			ConnectionTestBackgroundProcess,
			"status" | "error" | "finishedAt" | "step" | "stepText" | "progress"
		>
	>,
): void {
	updateProcess(processId, (process) => {
		if (!isConnectionTestProcess(process)) return process;
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
				...process.streamMetrics,
				totalRequestMs: totalRequestMs ?? process.streamMetrics.totalRequestMs,
			},
		};
	});
}

async function runConnectionTest(processId: string): Promise<void> {
	const initial = getProcessById(processId);
	if (!initial || !isConnectionTestProcess(initial)) return;
	if (initial.status !== "queued") return;

	const abortController = new AbortController();
	registerAbort(processId, abortController);
	const { signal } = abortController;
	const { modelId } = initial;

	const startedAt = Date.now();
	let firstTokenAtMs: number | null = null;
	let lastTokenAtMs: number | null = null;
	let generationEndedAtMs: number | null = null;
	let tokenTotals: TokenTotals | null = null;
	let resultResponse = "";
	let logs: PipelineLogEntry[] = [];

	const agentHandlers = createSingleAgentRunHandlers({
		onStateChange: (state) => {
			updateProcess(processId, (process) => {
				if (!isConnectionTestProcess(process)) return process;
				return {
					...process,
					prompt: state.userPrompt,
					response: state.outputText,
					messages: state.messages,
				};
			});
		},
		onResult: (data: JobResultDataPart) => {
			if (typeof data.response === "string") {
				resultResponse = data.response;
			}
		},
	});

	updateProcess(processId, (process) => {
		if (!isConnectionTestProcess(process)) return process;
		return {
			...process,
			status: "running",
			startedAt,
			progress: 5,
			step: "Starting connection test...",
			stepText: "Starting connection test...",
			prompt: "",
			response: "",
			messages: [],
			error: null,
			tokenTotals: null,
			logs: [],
			streamMetrics: EMPTY_STREAM_METRICS,
		};
	});

	const publishStreamMetrics = (completionTokens?: number | null) => {
		return buildStreamPerfMetrics({
			testStartedAtMs: startedAt,
			firstTokenAtMs,
			lastTokenAtMs,
			generationEndedAtMs,
			completionTokens: completionTokens ?? tokenTotals?.completion,
		});
	};

	try {
		await runJobPipeline({
			request: {
				url: "/api/test-connection",
				init: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ modelId }),
				},
				signal,
			},
			handlers: {
				...agentHandlers,
				onProgress: (_ctx, data) => {
					updateProcess(processId, (process) => {
						if (!isConnectionTestProcess(process)) return process;
						const patch: Partial<ConnectionTestBackgroundProcess> = {};
						if (data.percent != null) patch.progress = data.percent;
						if (data.step) {
							patch.step = data.step;
							patch.stepText = data.step;
						}
						return { ...process, ...patch };
					});
				},
				onLog: (entry) => {
					logs = [...logs, entry];
					updateProcess(processId, (process) => {
						if (!isConnectionTestProcess(process)) return process;
						return { ...process, logs };
					});
				},
				onAgentRun: (ctx, data) => {
					agentHandlers.onAgentRun?.(ctx, data);

					const now = Date.now();
					if (data.eventType === "token" && data.rawText) {
						if (firstTokenAtMs == null) {
							firstTokenAtMs = now;
						}
						lastTokenAtMs = now;
					}

					const nextTokenTotals = extractUsageTokenTotals(data);
					if (nextTokenTotals) {
						generationEndedAtMs = now;
						tokenTotals = nextTokenTotals;
					}

					if (data.eventType === "token" && (data.rawText || nextTokenTotals)) {
						const streamMetrics = publishStreamMetrics(
							nextTokenTotals?.completion,
						);
						updateProcess(processId, (process) => {
							if (!isConnectionTestProcess(process)) return process;
							return {
								...process,
								...(nextTokenTotals ? { tokenTotals: nextTokenTotals } : {}),
								streamMetrics,
							};
						});
					}
				},
			},
		});

		const finalProcess = getProcessById(processId);
		const response =
			finalProcess && isConnectionTestProcess(finalProcess)
				? finalProcess.response.trim().length > 0
					? finalProcess.response
					: resultResponse
				: resultResponse;

		const finishedAt = Date.now();
		const streamMetrics = publishStreamMetrics();
		updateProcess(processId, (process) => {
			if (!isConnectionTestProcess(process)) return process;
			return {
				...process,
				response,
				streamMetrics: {
					...streamMetrics,
					totalRequestMs:
						computeTotalRequestMs(startedAt, finishedAt) ??
						streamMetrics.totalRequestMs,
				},
			};
		});

		finishProcess(processId, {
			status: "success",
			progress: 100,
			step: "Completed",
			stepText: "Completed",
		});
	} catch (err) {
		if (isAbortError(err) || signal.aborted) {
			finishProcess(processId, {
				status: "canceled",
				step: "Canceled",
				stepText: "Canceled",
				error: "Connection test canceled",
			});
			return;
		}

		const message =
			err instanceof Error ? err.message : "Connection test failed";
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

export function startQueuedConnectionTest(processId: string): void {
	const process = getProcessById(processId);
	if (!process || !isConnectionTestProcess(process)) return;
	if (process.status !== "queued") return;

	void runConnectionTest(processId);
}

export function startConnectionTest(
	modelId: number,
	options: StartConnectionTestOptions,
): string {
	const processId = connectionTestProcessId(modelId);
	const existing = getConnectionTestProcessForModel(modelId);
	if (
		existing &&
		(existing.status === "queued" || existing.status === "running")
	) {
		cancelConnectionTest(modelId);
	}

	const now = Date.now();
	const process: ConnectionTestBackgroundProcess = {
		kind: "connection-test",
		id: processId,
		modelId,
		modelDisplayName: options.modelDisplayName,
		providerName: options.providerName ?? null,
		status: "queued",
		createdAt: now,
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
		streamMetrics: EMPTY_STREAM_METRICS,
	};

	upsertProcess(process);
	runNextQueued();
	return processId;
}

export function cancelConnectionTest(modelId: number): void {
	const processId = connectionTestProcessId(modelId);
	const controller = getAbortController(processId);
	if (controller) {
		controller.abort();
		unregisterAbort(processId);
	}

	updateProcess(processId, (process) => {
		if (!isConnectionTestProcess(process)) return process;
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
			error: "Connection test canceled",
			streamMetrics: {
				...process.streamMetrics,
				totalRequestMs: totalRequestMs ?? process.streamMetrics.totalRequestMs,
			},
		};
	});
	runNextQueued();
}

export function getConnectionTestProcessForModel(
	modelId: number,
): ConnectionTestBackgroundProcess | null {
	const process = getProcessById(connectionTestProcessId(modelId));
	if (!process || !isConnectionTestProcess(process)) return null;
	return process;
}
