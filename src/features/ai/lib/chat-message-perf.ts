import {
	getThreadMessageTokenUsage,
	type TokenUsageExtractableMessage,
} from "@assistant-ui/react-ai-sdk";
import type { MessageTiming } from "@assistant-ui/core";
import type { UIMessage } from "ai";
import { formatDisplayTokens } from "@/features/ai/lib/format-display-tokens";
import { formatTokensPerSecond } from "@/features/ai/lib/stream-perf-metrics";

export const CHAT_MESSAGE_PERF_CUSTOM_KEY = "perf";

export interface ChatMessagePerf {
	outputTokens: number | null;
	totalRequestMs: number | null;
	tokensPerSecond: number | null;
	completedAtMs: number | null;
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
		completedAtMs: asTimestampMs(perf.completedAtMs),
	};
}

export function buildChatMessagePerf(input: {
	usageSource: TokenUsageExtractableMessage | undefined;
	timing?: MessageTiming | null;
}): ChatMessagePerf | null {
	const usage = getThreadMessageTokenUsage(input.usageSource);
	const outputTokens = usage?.outputTokens ?? null;
	const totalRequestMs = input.timing?.totalStreamTime ?? null;

	const tokensPerSecond = computeTokensPerSecond(outputTokens, totalRequestMs);
	const completedAtMs = resolveCompletedAtMs(input.timing);

	if (
		outputTokens == null &&
		totalRequestMs == null &&
		tokensPerSecond == null &&
		completedAtMs == null
	) {
		return null;
	}

	return {
		outputTokens,
		totalRequestMs,
		tokensPerSecond,
		completedAtMs,
	};
}

export function getAssistantMessagePerfView(input: {
	metadata: MessageMetadataLike;
	role?: string;
	completedAtMs?: number | null;
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
		livePerf?.totalRequestMs ??
		savedPerf?.totalRequestMs ??
		asDurationMs(timing?.totalStreamTime) ??
		null;
	const tokensPerSecond =
		livePerf?.tokensPerSecond ??
		savedPerf?.tokensPerSecond ??
		computeTokensPerSecond(outputTokens, totalRequestMs) ??
		asRate(timing?.tokensPerSecond) ??
		null;
	const completedAtMs =
		savedPerf?.completedAtMs ??
		livePerf?.completedAtMs ??
		resolveCompletedAtMs(timing) ??
		asTimestampMs(input.completedAtMs) ??
		null;

	return {
		outputTokens,
		totalRequestMs,
		tokensPerSecond,
		completedAtMs,
		hasData:
			outputTokens != null ||
			totalRequestMs != null ||
			tokensPerSecond != null ||
			completedAtMs != null,
	};
}

export function attachChatMessagePerf(
	message: UIMessage,
	perf: ChatMessagePerf,
): UIMessage {
	const metadata = asRecord(message.metadata) ?? {};
	const custom = asRecord(metadata.custom) ?? {};

	return {
		...message,
		metadata: {
			...metadata,
			custom: {
				...custom,
				[CHAT_MESSAGE_PERF_CUSTOM_KEY]: finalizeChatMessagePerf(perf),
			},
		},
	};
}

export function mergePreservedChatPerf(
	existing: UIMessage,
	incoming: UIMessage,
): UIMessage {
	const existingPerf = readSavedChatMessagePerf(
		existing.metadata as MessageMetadataLike,
	);
	if (!existingPerf) return incoming;

	const incomingPerf = readSavedChatMessagePerf(
		incoming.metadata as MessageMetadataLike,
	);
	return attachChatMessagePerf(
		incoming,
		finalizeChatMessagePerf({
			outputTokens: incomingPerf?.outputTokens ?? existingPerf.outputTokens,
			totalRequestMs:
				incomingPerf?.totalRequestMs ?? existingPerf.totalRequestMs,
			tokensPerSecond:
				incomingPerf?.tokensPerSecond ?? existingPerf.tokensPerSecond,
			completedAtMs: incomingPerf?.completedAtMs ?? existingPerf.completedAtMs,
		}),
	);
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

		return attachChatMessagePerf(message, perf);
	});
}

export function formatChatMessagePerfLine(perf: AssistantMessagePerfView): string {
	const parts: string[] = [];

	if (perf.outputTokens != null) {
		parts.push(`${formatDisplayTokens(perf.outputTokens)} saída`);
	}
	if (perf.totalRequestMs != null) {
		parts.push(`${formatDurationMs(perf.totalRequestMs)} lat.`);
	}
	if (perf.tokensPerSecond != null) {
		parts.push(formatTokensPerSecond(perf.tokensPerSecond));
	}
	if (perf.completedAtMs != null) {
		parts.push(formatChatMessagePerfTime(perf.completedAtMs));
	}

	return parts.join(" · ");
}

export function formatChatMessagePerfTime(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return "—";
	return new Date(ms).toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
	});
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

function asTimestampMs(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: null;
}

function finalizeChatMessagePerf(perf: ChatMessagePerf): ChatMessagePerf {
	const tokensPerSecond =
		perf.tokensPerSecond ??
		computeTokensPerSecond(perf.outputTokens, perf.totalRequestMs);

	return {
		...perf,
		tokensPerSecond,
	};
}

function computeTokensPerSecond(
	outputTokens: number | null,
	totalRequestMs: number | null,
): number | null {
	if (
		outputTokens == null ||
		totalRequestMs == null ||
		totalRequestMs <= 0
	) {
		return null;
	}

	const rate = outputTokens / (totalRequestMs / 1000);
	return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function resolveCompletedAtMs(
	timing: MessageTiming | null | undefined,
): number | null {
	if (timing?.streamStartTime == null) return null;
	const totalStreamTime = asDurationMs(timing.totalStreamTime);
	if (totalStreamTime == null) return null;
	return timing.streamStartTime + totalStreamTime;
}
