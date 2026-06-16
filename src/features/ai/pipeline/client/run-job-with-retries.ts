import { updateProcess } from "@/features/background-processes/store/store";
import type { PipelineErrorState, PipelineLogEntry } from "../types";
import { isAbortError } from "./catch-pipeline-error";
import { errorToPipelineErrorState } from "./run-job-pipeline";

export interface RafProcessBatcher<TPatch extends object> {
	queue: (patch: TPatch) => void;
	flush: (patch?: TPatch) => void;
	dispose: () => void;
}

export function createRafProcessBatcher<TProcess, TPatch extends object>(
	processId: string,
	options: {
		isProcess: (process: unknown) => process is TProcess;
		patchProcess: (process: TProcess, patch: TPatch) => TProcess;
	},
): RafProcessBatcher<TPatch> {
	let pending: TPatch = {} as TPatch;
	let rafId: number | null = null;

	const applyPending = () => {
		rafId = null;
		if (Object.keys(pending).length === 0) return;
		const patch = pending;
		pending = {} as TPatch;
		updateProcess(processId, (process) => {
			if (!options.isProcess(process)) return process;
			return options.patchProcess(process, patch) as typeof process;
		});
	};

	return {
		queue(patch: TPatch) {
			pending = { ...pending, ...patch };
			if (rafId === null) {
				rafId = requestAnimationFrame(applyPending);
			}
		},
		flush(patch?: TPatch) {
			if (patch) {
				pending = { ...pending, ...patch };
			}
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			applyPending();
		},
		dispose() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			pending = {} as TPatch;
		},
	};
}

function defaultBackoffMs(attempt: number): number {
	return Math.min(1_000 * 2 ** (attempt - 1), 8_000);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException("Aborted", "AbortError"));
			return;
		}
		const timeoutId = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timeoutId);
			reject(new DOMException("Aborted", "AbortError"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

export interface RunJobWithRetriesOptions {
	maxAttempts?: number;
	backoffMs?: (attempt: number) => number;
	signal?: AbortSignal;
	onRetry?: (info: {
		attempt: number;
		maxAttempts: number;
		error: PipelineErrorState;
	}) => void;
	onLog?: (entry: Omit<PipelineLogEntry, "id"> & { id?: string }) => void;
	run: () => Promise<void>;
}

export async function runJobWithRetries(
	options: RunJobWithRetriesOptions,
): Promise<void> {
	const maxAttempts = options.maxAttempts ?? 3;
	const backoffMs = options.backoffMs ?? defaultBackoffMs;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			await options.run();
			return;
		} catch (error) {
			if (options.signal?.aborted || isAbortError(error)) {
				throw error;
			}

			const pipelineError = errorToPipelineErrorState(error);
			if (!pipelineError.retryable || attempt >= maxAttempts) {
				throw error;
			}

			options.onRetry?.({ attempt, maxAttempts, error: pipelineError });
			options.onLog?.({
				timestamp: Date.now(),
				level: "warning",
				message: `Attempt ${attempt}/${maxAttempts} failed: ${pipelineError.message}`,
			});

			await sleep(backoffMs(attempt), options.signal);
		}
	}
}
