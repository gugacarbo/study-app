import type { UIMessage } from "ai";
import { consumeJobStream } from "@/features/ai/lib/read-job-ui-message-stream";
import {
	normalizeTokenTotals,
	type TokenTotals,
} from "@/features/ai/components/token-totals-badge";
import {
	buildStreamPerfMetrics,
	type StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import { extractTokenTotalsFromUsage } from "@/features/ai/lib/token-usage";
import type {
	AgentRunDataPart,
	JobProgressDataPart,
	JobResultDataPart,
} from "@/features/ai/types/ui-message-data-parts";

const CONNECTION_TEST_AGENT_RUN_ID = "connection-test";

export type ConnectionTestStreamState = {
	progress: number;
	step: string;
	prompt: string;
	response: string;
	messages: UIMessage[];
	tokenTotals: TokenTotals | null;
	streamMetrics: StreamPerfMetrics;
};

export type ConnectionTestStreamCallbacks = {
	onUpdate: (patch: Partial<ConnectionTestStreamState>) => void;
};

export type ConnectionTestStreamResult = {
	response: string;
	messages: UIMessage[];
	tokenTotals: TokenTotals | null;
	streamMetrics: StreamPerfMetrics;
};

function parseCombinedPrompt(combined: string): { system: string; user: string } {
	const match = combined.match(/\[System\]\n([\s\S]*?)\n\n\[User\]\n([\s\S]*)/);
	if (!match) {
		return { system: "", user: combined };
	}

	return {
		system: match[1]?.trim() ?? "",
		user: match[2]?.trim() ?? "",
	};
}

export function buildConnectionTestMessages(
	combinedPrompt: string,
	response: string,
): UIMessage[] {
	const { system, user } = parseCombinedPrompt(combinedPrompt);
	const messages: UIMessage[] = [];

	if (system) {
		messages.push({
			id: `${CONNECTION_TEST_AGENT_RUN_ID}:system`,
			role: "system",
			parts: [{ type: "text", text: system }],
		});
	}

	if (user) {
		messages.push({
			id: `${CONNECTION_TEST_AGENT_RUN_ID}:user`,
			role: "user",
			parts: [{ type: "text", text: user }],
		});
	}

	messages.push({
		id: `${CONNECTION_TEST_AGENT_RUN_ID}:assistant`,
		role: "assistant",
		parts: [{ type: "text", text: response }],
	});

	return messages;
}

function appendResponseDelta(
	current: string,
	data: AgentRunDataPart,
): string | null {
	if (data.eventType !== "token") return null;

	if (typeof data.rawText === "string" && data.rawText.length > 0) {
		return `${current}${data.rawText}`;
	}

	if (typeof data.tokens === "string" && data.tokens.length > 0) {
		return `${current}${data.tokens}`;
	}

	return null;
}

function extractUsageTokenTotals(data: AgentRunDataPart): TokenTotals | null {
	if (data.eventType !== "token" || data.tokens == null) return null;
	if (typeof data.tokens === "string") return null;
	return (
		extractTokenTotalsFromUsage(data.tokens) ??
		normalizeTokenTotals(data.tokens as Partial<TokenTotals>)
	);
}

const EMPTY_STREAM_METRICS: StreamPerfMetrics = {
	ttftMs: null,
	tokensPerSecond: null,
};

function publishStreamMetrics(
	state: ConnectionTestStreamState,
	timing: {
		testStartedAtMs: number;
		firstTokenAtMs: number | null;
		lastTokenAtMs: number | null;
	},
): StreamPerfMetrics {
	const streamMetrics = buildStreamPerfMetrics({
		testStartedAtMs: timing.testStartedAtMs,
		firstTokenAtMs: timing.firstTokenAtMs,
		lastTokenAtMs: timing.lastTokenAtMs,
		completionTokens: state.tokenTotals?.completion,
	});
	state.streamMetrics = streamMetrics;
	return streamMetrics;
}

export async function consumeConnectionTestStream(
	modelId: number,
	callbacks: ConnectionTestStreamCallbacks,
	signal?: AbortSignal,
	options?: { testStartedAtMs?: number },
): Promise<ConnectionTestStreamResult> {
	let resultResponse = "";
	const testStartedAtMs = options?.testStartedAtMs ?? Date.now();
	let firstTokenAtMs: number | null = null;
	let lastTokenAtMs: number | null = null;
	const state: ConnectionTestStreamState = {
		progress: 5,
		step: "Starting connection test...",
		prompt: "",
		response: "",
		messages: [],
		tokenTotals: null,
		streamMetrics: EMPTY_STREAM_METRICS,
	};

	const publish = (patch: Partial<ConnectionTestStreamState>) => {
		Object.assign(state, patch);
		callbacks.onUpdate(patch);
	};

	publish(state);

	await consumeJobStream(
		{
			url: "/api/test-connection",
			init: {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ modelId }),
			},
			signal,
		},
		{
			onData: (part) => {
				if (part.type === "data-job-progress") {
					const data = part.data as JobProgressDataPart;
					const patch: Partial<ConnectionTestStreamState> = {};
					if (data.percent != null) patch.progress = data.percent;
					if (data.step) patch.step = data.step;
					if (Object.keys(patch).length > 0) {
						publish(patch);
					}
					return;
				}

				if (part.type === "data-agent-run") {
					const data = part.data as AgentRunDataPart;
					if (
						data.eventType === "lifecycle" &&
						data.status === "pending" &&
						data.userPrompt
					) {
						const messages = buildConnectionTestMessages(data.userPrompt, "");
						publish({
							prompt: data.userPrompt,
							messages,
						});
					}

					const responseDelta = appendResponseDelta(state.response, data);
					if (responseDelta != null) {
						const now = Date.now();
						if (firstTokenAtMs == null) {
							firstTokenAtMs = now;
						}
						lastTokenAtMs = now;

						const messages = buildConnectionTestMessages(
							state.prompt,
							responseDelta,
						);
						publish({
							response: responseDelta,
							messages,
							streamMetrics: publishStreamMetrics(state, {
								testStartedAtMs,
								firstTokenAtMs,
								lastTokenAtMs,
							}),
						});
					}

					const tokenTotals = extractUsageTokenTotals(data);
					if (tokenTotals) {
						const streamMetrics = publishStreamMetrics(
							{ ...state, tokenTotals },
							{
								testStartedAtMs,
								firstTokenAtMs,
								lastTokenAtMs,
							},
						);
						publish({ tokenTotals, streamMetrics });
					}
					return;
				}

				if (part.type === "data-job-result") {
					const data = part.data as JobResultDataPart;
					if (typeof data.response === "string") {
						resultResponse = data.response;
					}
				}
			},
		},
	);

	const response =
		state.response.trim().length > 0 ? state.response : resultResponse;
	const messages =
		state.prompt.trim().length > 0
			? buildConnectionTestMessages(state.prompt, response)
			: state.messages;

	const streamMetrics = publishStreamMetrics(state, {
		testStartedAtMs,
		firstTokenAtMs,
		lastTokenAtMs: lastTokenAtMs ?? Date.now(),
	});

	publish({
		progress: 100,
		step: "Completed",
		response,
		messages,
		streamMetrics,
	});

	return {
		response,
		messages,
		tokenTotals: state.tokenTotals,
		streamMetrics,
	};
}
