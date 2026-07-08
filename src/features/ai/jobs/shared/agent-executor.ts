import { defaultSleep } from "@/features/ai/jobs/ingest/run-ingest/llm-helpers";

export { defaultSleep };

export type AgentRetryConfig = {
	maxRetries?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	backoffMultiplier?: number;
};

export type AgentExecutionConfig = {
	timeoutMs?: number;
	retry?: AgentRetryConfig;
};

export const DEFAULT_AGENT_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_AGENT_RETRY_CONFIG: Required<AgentRetryConfig> = {
	maxRetries: 3,
	baseDelayMs: 500,
	maxDelayMs: 60_000,
	backoffMultiplier: 2,
};

export class AgentTimeoutError extends Error {
	constructor(message = "Agent execution timed out") {
		super(message);
		this.name = "AgentTimeoutError";
	}
}

export function computeRetryDelay(
	attempt: number,
	config: Required<AgentRetryConfig>,
): number {
	const delay =
		config.baseDelayMs * config.backoffMultiplier ** Math.max(0, attempt - 1);
	return Math.min(delay, config.maxDelayMs);
}

export type AgentExecutionContext = {
	previousAttemptContext?: string;
	attempt: number;
	abortSignal: AbortSignal;
	appendAttemptContext: (line: string) => void;
};

export async function executeAgentWithRetry<T>(input: {
	execute: (context: AgentExecutionContext) => Promise<T>;
	buildContinueContext: (error: unknown, attemptContext: string[]) => string;
	onRetry?: (
		error: unknown,
		attempt: number,
		nextDelayMs: number,
	) => Promise<void>;
	config?: AgentExecutionConfig;
	sleep?: (ms: number) => Promise<void>;
	initialPreviousAttemptContext?: string;
}): Promise<T> {
	const timeoutMs = input.config?.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS;
	const retryConfig: Required<AgentRetryConfig> = {
		...DEFAULT_AGENT_RETRY_CONFIG,
		...input.config?.retry,
	};
	const sleep = input.sleep ?? defaultSleep;

	let previousAttemptContext = input.initialPreviousAttemptContext;
	let lastError: unknown;

	for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt += 1) {
		const abortController = new AbortController();
		const timeoutId =
			timeoutMs > 0
				? setTimeout(
						() => abortController.abort(new AgentTimeoutError()),
						timeoutMs,
					)
				: null;

		const attemptContext: string[] = [];
		if (previousAttemptContext) {
			attemptContext.push(previousAttemptContext);
		}

		const appendAttemptContext = (line: string) => {
			attemptContext.push(line);
		};

		try {
			const result = await input.execute({
				previousAttemptContext,
				attempt: attempt + 1,
				abortSignal: abortController.signal,
				appendAttemptContext,
			});
			if (timeoutId) clearTimeout(timeoutId);
			return result;
		} catch (error) {
			if (timeoutId) clearTimeout(timeoutId);
			lastError = error;
			const errorMessage =
				error instanceof Error ? error.message : "unknown_error";
			attemptContext.push(`error: ${errorMessage}`);
			previousAttemptContext = input.buildContinueContext(
				error,
				attemptContext,
			);

			if (attempt >= retryConfig.maxRetries) {
				throw error;
			}

			const nextDelayMs = computeRetryDelay(attempt + 1, retryConfig);
			if (input.onRetry) {
				await input.onRetry(error, attempt + 1, nextDelayMs);
			}
			await sleep(nextDelayMs);
		}
	}

	throw lastError ?? new Error("Agent retry loop exited unexpectedly");
}
