import type { LanguageModelUsage, StopCondition, ToolSet } from "ai";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import {
	type AiStreamState,
	createAiStreamState,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import { streamTextWithCompatibilityFallback } from "@/features/ai/core/stream-text-compat";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import { createLlmLogContext } from "@/lib/llm-logging";
import type { ProviderConfig } from "@/lib/validation";

export interface PipelineTextAgentResult {
	success: boolean;
	reason?: string;
	text: string;
	usage?: LanguageModelUsage;
	usedGenerateTextFallback: boolean;
	streamState: AiStreamState;
}

export interface RunPipelineTextAgentParams {
	scope: string;
	stageId: string;
	config: ProviderConfig;
	run: AgentRunDescriptor;
	emit: AgentEventEmitter;
	systemPrompt: string;
	userPrompt: string;
	meta?: Record<string, unknown>;
	requestSummary?: string;
	includePromptsInPending?: boolean;
	abortSignal?: AbortSignal;
	tools?: ToolSet;
	stopWhen?:
		| StopCondition<NoInfer<ToolSet>>
		| Array<StopCondition<NoInfer<ToolSet>>>;
	onRecoverableError?: (message: string) => void;
}

function mergeMeta(
	base: Record<string, unknown> | undefined,
	extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!base && !extra) return undefined;
	return { ...base, ...extra };
}

type AgentRunEventPayload = Omit<
	AgentRunDataPart,
	"timestamp" | "stageId" | "agentRunId" | "label"
>;

function emitRunEvent(
	emit: AgentEventEmitter,
	run: AgentRunDescriptor,
	event: AgentRunEventPayload,
	meta?: Record<string, unknown>,
): void {
	emit({
		...event,
		stageId: run.stageId,
		agentRunId: run.agentRunId,
		label: run.label,
		meta: mergeMeta(meta, event.meta),
	});
}

export async function runPipelineTextAgent(
	params: RunPipelineTextAgentParams,
): Promise<PipelineTextAgentResult> {
	const streamState = createAiStreamState();
	const { run, emit, meta } = params;
	let responseText = "";
	let usage: LanguageModelUsage | undefined;

	emitRunEvent(
		emit,
		run,
		{
			eventType: "lifecycle",
			status: "pending",
			...(params.includePromptsInPending === false
				? {}
				: {
						systemPrompt: params.systemPrompt,
						userPrompt: params.userPrompt,
					}),
		},
		meta,
	);
	emitRunEvent(emit, run, { eventType: "lifecycle", status: "running" }, meta);

	const llmLogContext = createLlmLogContext(params.scope, params.config, {
		callId: run.agentRunId,
		systemPrompt: params.systemPrompt,
		requestSummary: params.requestSummary ?? params.userPrompt,
		metadata: params.meta,
	});

	try {
		const generation = await streamTextWithCompatibilityFallback({
			ctx: llmLogContext,
			request: {
				model: getAiModel(params.config),
				system: params.systemPrompt,
				messages: [{ role: "user" as const, content: params.userPrompt }],
				tools: params.tools,
				stopWhen: params.stopWhen,
				providerOptions: buildProviderOptions(params.config),
				abortSignal: params.abortSignal,
			},
			onStreamPart: (chunk) => {
				processAiStreamPart(
					chunk,
					{
						onTextDelta: (delta) => {
							responseText += delta;
							emitRunEvent(
								emit,
								run,
								{ eventType: "token", rawText: delta },
								meta,
							);
						},
						onReasoningDelta: (delta) => {
							emitRunEvent(
								emit,
								run,
								{
									eventType: "token",
									rawText: delta,
									meta: { kind: "reasoning" },
								},
								meta,
							);
						},
						onUsage: (nextUsage) => {
							usage = nextUsage;
							emitRunEvent(
								emit,
								run,
								{ eventType: "token", tokens: nextUsage },
								meta,
							);
						},
					},
					streamState,
				);
			},
		});

		if (
			generation.usedGenerateTextFallback &&
			responseText.trim().length === 0 &&
			generation.text.length > 0
		) {
			responseText = generation.text;
			emitRunEvent(
				emit,
				run,
				{ eventType: "token", rawText: generation.text },
				meta,
			);
		}

		if (!usage && generation.usage) {
			usage = generation.usage;
			emitRunEvent(
				emit,
				run,
				{ eventType: "token", tokens: generation.usage },
				meta,
			);
		}

		const text = generation.text || responseText.trim();

		emitRunEvent(emit, run, { eventType: "lifecycle", status: "done" }, meta);

		return {
			success: true,
			text,
			usage: usage ?? generation.usage,
			usedGenerateTextFallback: generation.usedGenerateTextFallback,
			streamState,
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : "unknown error";

		params.onRecoverableError?.(reason);
		emitRunEvent(
			emit,
			run,
			{ eventType: "lifecycle", status: "error", error: reason },
			meta,
		);

		return {
			success: false,
			reason,
			text: responseText.trim() || streamState.rawText,
			usage,
			usedGenerateTextFallback: false,
			streamState,
		};
	}
}
