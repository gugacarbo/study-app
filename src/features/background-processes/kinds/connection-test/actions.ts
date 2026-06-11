import { consumeConnectionTestStream } from "@/features/ai/lib/connection-test-stream";
import type { StreamPerfMetrics } from "@/features/ai/lib/stream-perf-metrics";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import { getProcessById, updateProcess, upsertProcess } from "../../store/store";
import type { ConnectionTestBackgroundProcess } from "../../store/types";
import {
	connectionTestProcessId,
	isConnectionTestProcess,
} from "../../store/types";
import type { StartConnectionTestOptions } from "./types";

const EMPTY_STREAM_METRICS: StreamPerfMetrics = {
	ttftMs: null,
	tokensPerSecond: null,
};

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function finishProcess(
	processId: string,
	patch: Partial<
		Pick<
			ConnectionTestBackgroundProcess,
			"status" | "error" | "finishedAt" | "step" | "progress"
		>
	>,
): void {
	updateProcess(processId, (process) => {
		if (!isConnectionTestProcess(process)) return process;
		return {
			...process,
			...patch,
			finishedAt: patch.finishedAt ?? Date.now(),
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
	updateProcess(processId, (process) => {
		if (!isConnectionTestProcess(process)) return process;
		return {
			...process,
			status: "running",
			startedAt,
			progress: 5,
			step: "Starting connection test...",
			prompt: "",
			response: "",
			error: null,
			tokenTotals: null,
			streamMetrics: EMPTY_STREAM_METRICS,
		};
	});

	try {
		await consumeConnectionTestStream(
			modelId,
			{
				onUpdate: (patch) => {
					const { messages: _messages, ...processPatch } = patch;
					updateProcess(processId, (process) => {
						if (!isConnectionTestProcess(process)) return process;
						return { ...process, ...processPatch };
					});
				},
			},
			signal,
			{ testStartedAtMs: startedAt },
		);

		finishProcess(processId, {
			status: "success",
			progress: 100,
			step: "Completed",
		});
	} catch (err) {
		if (isAbortError(err) || signal.aborted) {
			finishProcess(processId, {
				status: "canceled",
				step: "Canceled",
				error: "Connection test canceled",
			});
			return;
		}

		const message =
			err instanceof Error ? err.message : "Connection test failed";
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
		prompt: "",
		response: "",
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
		return {
			...process,
			status: "canceled",
			finishedAt: Date.now(),
			step: "Canceled",
			error: "Connection test canceled",
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
