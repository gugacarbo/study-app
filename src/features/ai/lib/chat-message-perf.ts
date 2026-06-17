import {
	getThreadMessageTokenUsage,
	type TokenUsageExtractableMessage,
} from "@assistant-ui/react-ai-sdk";
import type { MessageTiming } from "@assistant-ui/core";
import type { UIMessage } from "ai";
import { formatTokensPerSecond } from "@/features/ai/lib/stream-perf-metrics";

export const CHAT_MESSAGE_PERF_CUSTOM_KEY = "perf";

export interface ChatMessagePerf {
	outputTokens: number | null;
	totalRequestMs: number | null;
	tokensPerSecond: number | null;
}

export interface AssistantMessagePerfView extends ChatMessagePerf {
	hasData: boolean;
}

type MessageMetadataLike = Record<string, unknown> | undefined;

export function readSavedChatMessagePerf(
	metadata: MessageMetadataLike,
): ChatMessagePerf | null {
	const custom = asRecord(metadata?.custom);
	const perf = asRecord(custom?.[CHAT_MESSAGE_PERF_CUSTOM_KEY]);
	if (!perf) return null;

	return {
		outputTokens: asTokenCount(perf.outputTokens),
		totalRequestMs: asDurationMs(perf.totalRequestMs),
		tokensPerSecond: asRate(perf.tokensPerSecond),
	};
}

export function buildChatMessagePerf(input: {
	usageSource: TokenUsageExtractableMessage | undefined;
	timing?: MessageTiming | null;
}): ChatMessagePerf | null {
	const usage = getThreadMessageTokenUsage(input.usageSource);
	const outputTokens = usage?.outputTokens ?? null;
	const totalRequestMs = input.timing?.totalStreamTime ?? null;

	const tokensPerSecond =
		outputTokens != null && totalRequestMs != null && totalRequestMs > 0
			? outputTokens / (totalRequestMs / 1000)
			: null;

	if (
		outputTokens == null &&
		totalRequestMs == null &&
		tokensPerSecond == null
	) {
		return null;
	}

	return {
		outputTokens,
		totalRequestMs,
		tokensPerSecond:
			tokensPerSecond != null && Number.isFinite(tokensPerSecond)
				? tokensPerSecond
				: null,
	};
}

export function getAssistantMessagePerfView(input: {
	metadata: MessageMetadataLike;
	role?: string;
}): AssistantMessagePerfView {
	const savedPerf = readSavedChatMessagePerf(input.metadata);
	const timing = input.metadata?.timing as MessageTiming | undefined;
	const livePerf = buildChatMessagePerf({
		usageSource: {
			role: input.role,
			metadata: input.metadata,
		},
		timing,
	});

	const outputTokens =
		livePerf?.outputTokens ?? savedPerf?.outputTokens ?? null;
	const totalRequestMs =
		livePerf?.totalRequestMs ?? savedPerf?.totalRequestMs ?? null;
	const tokensPerSecond =
		livePerf?.tokensPerSecond ?? savedPerf?.tokensPerSecond ?? null;

	return {
		outputTokens,
		totalRequestMs,
		tokensPerSecond,
		hasData:
			outputTokens != null ||
			totalRequestMs != null ||
			tokensPerSecond != null,
	};
}

export function enrichMessagesWithChatPerf(
	messages: UIMessage[],
	timings: Record<string, MessageTiming>,
): UIMessage[] {
	return messages.map((message) => {
		if (message.role !== "assistant") return message;

		const perf = buildChatMessagePerf({
			usageSource: message,
			timing: timings[message.id],
		});
		if (!perf) return message;

		const metadata = asRecord(message.metadata) ?? {};
		const custom = asRecord(metadata.custom) ?? {};

		return {
			...message,
			metadata: {
				...metadata,
				custom: {
					...custom,
					[CHAT_MESSAGE_PERF_CUSTOM_KEY]: perf,
				},
			},
		};
	});
}

export function formatChatMessagePerfLine(perf: AssistantMessagePerfView): string {
	const parts: string[] = [];

	if (perf.outputTokens != null) {
		parts.push(`${perf.outputTokens.toLocaleString("pt-BR")} saída`);
	}
	if (perf.totalRequestMs != null) {
		parts.push(formatDurationMs(perf.totalRequestMs));
	}
	if (perf.tokensPerSecond != null) {
		parts.push(formatTokensPerSecond(perf.tokensPerSecond));
	}

	return parts.join(" · ");
}

export function formatDurationMs(ms: number | null | undefined): string {
	if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function asTokenCount(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: null;
}

function asDurationMs(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: null;
}

function asRate(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: null;
}
