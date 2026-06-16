import type { PrepareStepFunction, StopCondition, ToolSet } from "ai";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import {
	type AiStreamHandlers,
	type AiStreamState,
	createAiStreamState,
	flushAiStreamThinkTagDeltas,
	isAiStreamRunErrorChunk,
	isRecoverableStreamPartError,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import { createLlmLogContext } from "@/lib/llm-logging";
import type { ProviderConfig } from "@/lib/validation";

export function readToolFailureMessage(result: unknown): string | undefined {
	if (typeof result === "string") {
		try {
			return readToolFailureMessage(JSON.parse(result));
		} catch {
			return result.length > 0 ? result : undefined;
		}
	}
	if (typeof result !== "object" || result === null) return undefined;
	const errorValue = (result as { error?: unknown }).error;
	if (typeof errorValue === "string" && errorValue.length > 0) {
		return errorValue;
	}
	if (typeof errorValue !== "object" || errorValue === null) return undefined;
	return typeof (errorValue as { message?: unknown }).message === "string"
		? (errorValue as { message: string }).message
		: undefined;
}

export function isSuccessfulNamedToolResult(
	toolName: string,
	result: unknown,
	successToolName: string,
): boolean {
	if (toolName !== successToolName) return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}

export interface RunToolAgentStreamParams {
	scope: string;
	config: ProviderConfig;
	callId: string;
	requestSummary: string;
	metadata?: Record<string, unknown>;
	systemPrompt: string;
	messages: Array<{ role: "user" | "assistant"; content: string }>;
	tools: ToolSet;
	stopWhen:
		| StopCondition<NoInfer<ToolSet>>
		| Array<StopCondition<NoInfer<ToolSet>>>;
	prepareStep?: PrepareStepFunction<NoInfer<ToolSet>>;
	handlers: AiStreamHandlers;
	streamState?: AiStreamState;
	onRecoverableError?: (message: string) => void;
}

export async function runToolAgentStream(
	params: RunToolAgentStreamParams,
): Promise<AiStreamState> {
	const streamState = params.streamState ?? createAiStreamState();

	const result = loggedStreamText(
		createLlmLogContext(params.scope, params.config, {
			callId: params.callId,
			systemPrompt: params.systemPrompt,
			requestSummary: params.requestSummary,
			metadata: params.metadata,
		}),
		{
			model: getAiModel(params.config),
			system: params.systemPrompt,
			messages: params.messages,
			tools: params.tools,
			stopWhen: params.stopWhen,
			prepareStep: params.prepareStep,
			providerOptions: buildProviderOptions(params.config),
		},
	);

	for await (const chunk of result.fullStream) {
		if (isAiStreamRunErrorChunk(chunk)) {
			const message =
				chunk.error instanceof Error
					? chunk.error.message
					: String(chunk.error);

			if (isRecoverableStreamPartError(chunk)) {
				params.onRecoverableError?.(message);
				continue;
			}

			throw new Error(`AI provider returned error: ${message}`);
		}

		processAiStreamPart(chunk, params.handlers, streamState);
	}

	flushAiStreamThinkTagDeltas(params.handlers, streamState);

	return streamState;
}
