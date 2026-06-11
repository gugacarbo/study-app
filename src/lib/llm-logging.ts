import type { D1Database } from "@cloudflare/workers-types";
import type { LanguageModelUsage } from "ai";
import type { LLMLogInsert } from "@/db/queries/types";
import { env } from "@/env";
import type { ProviderConfig, ResolvedModelConfig } from "@/lib/validation";

type FinishEventLike = {
	text: string;
	reasoningText?: string;
	finishReason: string;
	usage: LanguageModelUsage;
	totalUsage?: LanguageModelUsage;
	steps?: FinishStepLike[];
};

type FinishStepLike = {
	stepNumber: number;
	text: string;
	reasoningText?: string;
	finishReason: string;
	usage: LanguageModelUsage;
	toolCalls?: Array<{ toolName: string; input?: unknown }>;
	toolResults?: Array<{ toolName: string; output?: unknown; isError?: boolean }>;
};

export interface LlmLogContext {
	callType: string;
	callId?: string;
	provider: string;
	model: string;
	baseUrl?: string;
	systemPrompt?: string;
	requestSummary?: string;
	metadata?: Record<string, unknown>;
}

export function isLlmLoggingEnabled(): boolean {
	return env.AI_LOG_LLM === "true";
}

export function shouldLogLlmContent(): boolean {
	return env.AI_LOG_LLM_CONTENT === "true";
}

export function shouldLogLlmChunks(): boolean {
	return env.AI_LOG_LLM_CHUNKS === "true";
}

export function createLlmLogCallId(
	callType: string,
	suffix?: string,
): string {
	const slug = callType.replace(/[^a-zA-Z0-9._-]+/g, "-");
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return suffix ? `${slug}-${suffix}-${unique}` : `${slug}-${unique}`;
}

export function resolveProviderLabel(
	config: ProviderConfig | ResolvedModelConfig,
): string {
	if ("providerName" in config && config.providerName) {
		return config.providerName;
	}
	try {
		return new URL(config.baseUrl).hostname;
	} catch {
		return "unknown";
	}
}

export function createLlmLogContext(
	callType: string,
	config: ProviderConfig | ResolvedModelConfig,
	options?: {
		callId?: string;
		systemPrompt?: string;
		requestSummary?: string;
		metadata?: Record<string, unknown>;
	},
): LlmLogContext {
	return {
		callType,
		callId: options?.callId,
		provider: resolveProviderLabel(config),
		model: config.model,
		baseUrl: config.baseUrl,
		systemPrompt: options?.systemPrompt,
		requestSummary: options?.requestSummary,
		metadata: options?.metadata,
	};
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function redactText(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length === 0) return "";
	return `[${trimmed.length} chars redacted]`;
}

function serializeUsage(usage: LanguageModelUsage): Record<string, number> {
	return {
		inputTokens: usage.inputTokens ?? 0,
		outputTokens: usage.outputTokens ?? 0,
		totalTokens: usage.totalTokens ?? 0,
		reasoningTokens: usage.reasoningTokens ?? 0,
		cachedInputTokens: usage.cachedInputTokens ?? 0,
	};
}

function serializeStep(
	step: FinishStepLike,
	includeContent: boolean,
): Record<string, unknown> {
	return {
		stepNumber: step.stepNumber,
		text: includeContent ? step.text : redactText(step.text),
		reasoningText:
			step.reasoningText === undefined
				? undefined
				: includeContent
					? step.reasoningText
					: redactText(step.reasoningText),
		finishReason: step.finishReason,
		usage: serializeUsage(step.usage),
		toolCalls: step.toolCalls?.map((toolCall) => ({
			toolName: toolCall.toolName,
			input: includeContent ? toolCall.input : undefined,
		})),
		toolResults: step.toolResults?.map((toolResult) => ({
			toolName: toolResult.toolName,
			isError: toolResult.isError,
			output: includeContent ? toolResult.output : undefined,
		})),
	};
}

export function serializeFinishEvent(
	event: FinishEventLike,
	includeContent: boolean,
): Record<string, unknown> {
	const steps = event.steps ?? [];
	return {
		text: includeContent ? event.text : redactText(event.text),
		reasoningText:
			event.reasoningText === undefined
				? undefined
				: includeContent
					? event.reasoningText
					: redactText(event.reasoningText),
		finishReason: event.finishReason,
		usage: serializeUsage(event.usage),
		totalUsage: event.totalUsage
			? serializeUsage(event.totalUsage)
			: undefined,
		steps: steps.map((step) => serializeStep(step, includeContent)),
	};
}

export function buildLlmLogInsert(
	ctx: LlmLogContext,
	event: {
		status: LLMLogInsert["status"];
		startedAt: number;
		finish?: FinishEventLike;
		errorMessage?: string;
		chunks?: number;
		requestPayload?: unknown;
		responsePayload?: unknown;
	},
): LLMLogInsert {
	const includeContent = shouldLogLlmContent();
	const callId = ctx.callId ?? createLlmLogCallId(ctx.callType);
	const responsePayload =
		event.responsePayload ??
		(event.finish
			? serializeFinishEvent(event.finish, includeContent)
			: undefined);

	return {
		callId,
		callType: ctx.callType,
		provider: ctx.provider,
		model: ctx.model,
		baseUrl: ctx.baseUrl,
		systemPrompt: includeContent ? ctx.systemPrompt : undefined,
		requestPayload: safeStringify({
			summary: ctx.requestSummary,
			metadata: ctx.metadata,
			payload: includeContent ? event.requestPayload : undefined,
		}),
		responsePayload: responsePayload ? safeStringify(responsePayload) : undefined,
		durationMs: Math.max(0, Date.now() - event.startedAt),
		chunks: event.chunks,
		finalChars: event.finish?.text.length,
		tokenMeta: event.finish?.totalUsage
			? safeStringify(serializeUsage(event.finish.totalUsage))
			: event.finish?.usage
				? safeStringify(serializeUsage(event.finish.usage))
				: undefined,
		errorMessage: event.errorMessage,
		status: event.status,
	};
}

export async function persistLlmLog(
	log: LLMLogInsert,
	db?: D1Database,
): Promise<void> {
	if (!isLlmLoggingEnabled()) return;

	const database =
		db ??
		(await import("@/server-functions/db").then(({ getDB }) => getDB()));
	if (!database) {
		console.warn("[llm-logging] D1 unavailable — skipping log persistence");
		return;
	}

	try {
		const { DBQueries } = await import("@/db/queries");
		const queries = new DBQueries(database);
		await queries.insertLLMLog(log);
	} catch (error) {
		console.error(
			"[llm-logging] Failed to persist log:",
			error instanceof Error ? error.message : error,
		);
	}
}

export function scheduleLlmLog(log: LLMLogInsert, db?: D1Database): void {
	void persistLlmLog(log, db);
}

export function logSyncGenerationResult(
	ctx: LlmLogContext,
	result: {
		text?: string;
		usage?: LanguageModelUsage;
		finishReason?: string;
		object?: unknown;
		steps?: FinishStepLike[];
	},
	startedAt: number,
	requestPayload?: unknown,
	db?: D1Database,
): void {
	const text =
		result.text ??
		(result.object !== undefined ? safeStringify(result.object) : "");
	const usage = result.usage;

	scheduleLlmLog(
		buildLlmLogInsert(ctx, {
			status: "success",
			startedAt,
			finish: {
				text,
				finishReason: result.finishReason ?? "stop",
				usage: usage ?? {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					inputTokenDetails: {
						noCacheTokens: 0,
						cacheReadTokens: 0,
						cacheWriteTokens: 0,
					},
					outputTokenDetails: {
						textTokens: 0,
						reasoningTokens: 0,
					},
				},
				totalUsage: usage,
				steps: result.steps,
			},
			requestPayload,
			responsePayload:
				result.object !== undefined
					? { object: shouldLogLlmContent() ? result.object : "[redacted]" }
					: undefined,
		}),
		db,
	);
}

export function logSyncGenerationError(
	ctx: LlmLogContext,
	error: unknown,
	startedAt: number,
	requestPayload?: unknown,
	db?: D1Database,
): void {
	scheduleLlmLog(
		buildLlmLogInsert(ctx, {
			status: "failed",
			startedAt,
			errorMessage: error instanceof Error ? error.message : String(error),
			requestPayload,
		}),
		db,
	);
}

type StreamTextOptions = NonNullable<Parameters<typeof import("ai").streamText>[0]>;

export function withStreamTextLogging(
	options: StreamTextOptions,
	ctx: LlmLogContext,
	db?: D1Database,
): StreamTextOptions {
	if (!isLlmLoggingEnabled()) return options;

	const callId = ctx.callId ?? createLlmLogCallId(ctx.callType);
	const startedAt = Date.now();
	let chunkCount = 0;
	const resolvedCtx = { ...ctx, callId };

	const userOnFinish = options.onFinish;
	const userOnStepFinish = options.onStepFinish;
	const userOnChunk = options.onChunk;
	const userOnError = options.onError;

	return {
		...options,
		experimental_telemetry: {
			isEnabled: true,
			functionId: ctx.callType,
			recordInputs: shouldLogLlmContent(),
			recordOutputs: shouldLogLlmContent(),
			metadata: ctx.metadata as
				| Record<string, import("@opentelemetry/api").AttributeValue>
				| undefined,
		},
		onChunk: userOnChunk
			? async (event) => {
					if (shouldLogLlmChunks()) chunkCount += 1;
					await userOnChunk(event);
				}
			: shouldLogLlmChunks()
				? async () => {
						chunkCount += 1;
					}
				: undefined,
		onStepFinish: async (step) => {
			if (shouldLogLlmChunks()) {
				scheduleLlmLog(
					buildLlmLogInsert(resolvedCtx, {
						status: "pending",
						startedAt,
						chunks: chunkCount,
						finish: {
							text: step.text,
							reasoningText: step.reasoningText,
							finishReason: step.finishReason,
							usage: step.usage,
							steps: [step],
						},
						requestPayload: {
							prompt: options.prompt,
							messages: options.messages,
						},
					}),
					db,
				);
			}
			await userOnStepFinish?.(step);
		},
		onError: async (event) => {
			scheduleLlmLog(
				buildLlmLogInsert(resolvedCtx, {
					status: "failed",
					startedAt,
					chunks: chunkCount,
					errorMessage:
						event.error instanceof Error
							? event.error.message
							: String(event.error),
					requestPayload: {
						prompt: options.prompt,
						messages: options.messages,
					},
				}),
				db,
			);
			await userOnError?.(event);
		},
		onFinish: async (event) => {
			scheduleLlmLog(
				buildLlmLogInsert(resolvedCtx, {
					status: "success",
					startedAt,
					chunks: chunkCount,
					finish: event,
					requestPayload: {
						prompt: options.prompt,
						messages: options.messages,
					},
				}),
				db,
			);
			await userOnFinish?.(event);
		},
	};
}
