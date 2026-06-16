import { mapWithConcurrency } from "@/features/ai/core/map-with-concurrency";
import type {
	AgentRunDescriptor,
	createAgentRunWriter,
} from "@/features/ai/core/ui-message-job-stream";
import type { PipelineLogger } from "./pipeline-logger";

type AgentRunWriter = ReturnType<typeof createAgentRunWriter>;

export interface BatchItemOutcome<TResult> {
	success: boolean;
	result?: TResult;
	error?: string;
}

export interface BatchItemCompleteEvent<TResult> extends BatchItemOutcome<TResult> {
	index: number;
	attempt: number;
}

export interface RunConcurrentBatchOptions<TItem, TResult> {
	items: TItem[];
	concurrency: number;
	maxAttempts?: number;
	failFast?: boolean;
	requireAtLeastOneSuccess?: boolean;
	mapper: (
		item: TItem,
		index: number,
		attempt: number,
	) => Promise<BatchItemOutcome<TResult>> | BatchItemOutcome<TResult>;
	onItemComplete?: (event: BatchItemCompleteEvent<TResult>) => void;
	onProgress?: (message: string) => void;
	onWarning?: (message: string, meta?: Record<string, unknown>) => void;
	log?: PipelineLogger;
	agentRuns?: AgentRunWriter;
	getRunForItem?: (item: TItem, index: number) => AgentRunDescriptor | undefined;
}

export interface RunConcurrentBatchResult<TResult> {
	results: BatchItemOutcome<TResult>[];
	successCount: number;
	failureCount: number;
}

async function runPass<TItem, TResult>(
	items: TItem[],
	indices: number[],
	concurrency: number,
	attempt: number,
	options: RunConcurrentBatchOptions<TItem, TResult>,
	results: BatchItemOutcome<TResult>[],
): Promise<void> {
	await mapWithConcurrency(indices, concurrency, async (index) => {
		const outcome = await options.mapper(items[index], index, attempt);
		results[index] = outcome;
		options.onItemComplete?.({ ...outcome, index, attempt });

		if (options.failFast && !outcome.success) {
			throw new Error(outcome.error ?? `Item ${index} failed`);
		}

		return outcome;
	});
}

export async function runConcurrentBatch<TItem, TResult>(
	options: RunConcurrentBatchOptions<TItem, TResult>,
): Promise<RunConcurrentBatchResult<TResult>> {
	const {
		items,
		concurrency,
		maxAttempts = 3,
		requireAtLeastOneSuccess = true,
		log,
		agentRuns,
		getRunForItem,
		onProgress,
		onWarning,
	} = options;

	if (items.length === 0) {
		return { results: [], successCount: 0, failureCount: 0 };
	}

	const results: BatchItemOutcome<TResult>[] = new Array(items.length);
	const allIndices = items.map((_, index) => index);

	await runPass(items, allIndices, concurrency, 1, options, results);

	if (
		requireAtLeastOneSuccess &&
		results.every((result) => result && !result.success)
	) {
		throw new Error(
			`All ${items.length} item${items.length === 1 ? "" : "s"} failed on the first cycle.`,
		);
	}

	for (let attempt = 2; attempt <= maxAttempts; attempt++) {
		const failedIndices = results
			.map((result, index) => (!result?.success ? index : -1))
			.filter((index) => index >= 0);

		if (failedIndices.length === 0) {
			break;
		}

		const retryMessage = `Retrying ${failedIndices.length} failed item${failedIndices.length === 1 ? "" : "s"} (attempt ${attempt}/${maxAttempts})...`;
		onProgress?.(retryMessage);
		log?.warning(retryMessage);

		await runPass(items, failedIndices, concurrency, attempt, options, results);
	}

	for (let index = 0; index < results.length; index++) {
		const outcome = results[index];
		if (!outcome || outcome.success) {
			continue;
		}

		const error = outcome.error ?? "Unknown error";
		const run = getRunForItem?.(items[index], index);
		if (run && agentRuns) {
			agentRuns.lifecycle(run, "error", { error });
		}

		onWarning?.(`Item ${index} failed: ${error}`, { index, error });
		log?.warning(`Item ${index} failed after ${maxAttempts} attempts`, {
			index,
			error,
		});
	}

	const successCount = results.filter((result) => result?.success).length;
	const failureCount = items.length - successCount;

	if (requireAtLeastOneSuccess && successCount === 0) {
		throw new Error(
			`All ${items.length} item${items.length === 1 ? "" : "s"} failed after ${maxAttempts} attempts.`,
		);
	}

	log?.info(
		`Batch complete: ${successCount}/${items.length} succeeded`,
	);

	return { results, successCount, failureCount };
}
