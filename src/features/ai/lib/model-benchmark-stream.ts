import type { UIMessage } from "ai";
import { consumeJobStream } from "@/features/ai/lib/read-job-ui-message-stream";
import {
	normalizeTokenTotals,
	type TokenTotals,
} from "@/features/ai/components/token-totals-badge";
import {
	buildBenchmarkPerfMetrics,
	createBenchmarkPhaseTiming,
	EMPTY_BENCHMARK_PERF_METRICS,
	noteBenchmarkPhaseTextDelta,
	noteBenchmarkPhaseToolCall,
	noteBenchmarkPhaseToolResult,
	type BenchmarkPerfMetrics,
	type BenchmarkPhaseMetrics,
	type BenchmarkPhaseTiming,
} from "@/features/ai/lib/stream-perf-metrics";
import { extractTokenTotalsFromUsage } from "@/features/ai/lib/token-usage";
import {
	createAgentRunState,
	reduceAgentEvent,
	type AgentRunReducerEvent,
	type AgentRunState,
} from "@/features/ai/utils/agent-run-messages";
import type {
	AgentRunDataPart,
	JobProgressDataPart,
	JobResultDataPart,
} from "@/features/ai/types/ui-message-data-parts";

export type ModelBenchmarkStreamState = {
	progress: number;
	step: string;
	messages: UIMessage[];
	tokenTotals: TokenTotals | null;
	benchmarkMetrics: BenchmarkPerfMetrics;
	phases: BenchmarkPhaseMetrics[];
	allPhasesPassed: boolean | null;
};

export type ModelBenchmarkStreamCallbacks = {
	onUpdate: (patch: Partial<ModelBenchmarkStreamState>) => void;
};

export type ModelBenchmarkStreamResult = {
	messages: UIMessage[];
	tokenTotals: TokenTotals | null;
	benchmarkMetrics: BenchmarkPerfMetrics;
	phases: BenchmarkPhaseMetrics[];
	allPhasesPassed: boolean;
};

function extractUsageTokenTotals(data: AgentRunDataPart): TokenTotals | null {
	if (data.eventType !== "token" || data.tokens == null) return null;
	if (typeof data.tokens === "string") return null;
	return (
		extractTokenTotalsFromUsage(data.tokens) ??
		normalizeTokenTotals(data.tokens as Partial<TokenTotals>)
	);
}

function mergeTokenTotals(
	current: TokenTotals | null,
	next: TokenTotals,
): TokenTotals {
	if (!current) return next;
	return {
		prompt: current.prompt + next.prompt,
		completion: current.completion + next.completion,
		total: current.total + next.total,
	};
}

function agentRunEventToReducerEvent(
	data: AgentRunDataPart,
): AgentRunReducerEvent | null {
	if (data.eventType === "token" && typeof data.rawText === "string") {
		return {
			eventType: "text-chunk",
			agentRunId: data.agentRunId,
			text: data.rawText,
			timestamp: data.timestamp,
		};
	}

	if (
		data.eventType === "lifecycle" ||
		data.eventType === "tool-call" ||
		data.eventType === "tool-result" ||
		data.eventType === "result" ||
		data.eventType === "warning"
	) {
		return data as AgentRunReducerEvent;
	}

	return null;
}

function parseBenchmarkPhaseMetrics(value: unknown): BenchmarkPhaseMetrics | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Partial<BenchmarkPhaseMetrics>;
	if (typeof record.phaseId !== "string" || typeof record.label !== "string") {
		return null;
	}
	return record as BenchmarkPhaseMetrics;
}

function parseBenchmarkPerfMetrics(value: unknown): BenchmarkPerfMetrics | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Partial<BenchmarkPerfMetrics>;
	if (!Array.isArray(record.phases) || !record.aggregate) return null;
	return record as BenchmarkPerfMetrics;
}

export async function consumeModelBenchmarkStream(
	modelId: number,
	callbacks: ModelBenchmarkStreamCallbacks,
	signal?: AbortSignal,
	options?: { testStartedAtMs?: number },
): Promise<ModelBenchmarkStreamResult> {
	const testStartedAtMs = options?.testStartedAtMs ?? Date.now();
	const runStates = new Map<string, AgentRunState>();
	const phaseTimings = new Map<string, BenchmarkPhaseTiming>();
	let jobFirstTokenAtMs: number | null = null;
	let jobLastTokenAtMs: number | null = null;
	let jobGenerationEndedAtMs: number | null = null;
	let totalCompletionTokens = 0;

	const state: ModelBenchmarkStreamState = {
		progress: 5,
		step: "Starting model benchmark...",
		messages: [],
		tokenTotals: null,
		benchmarkMetrics: EMPTY_BENCHMARK_PERF_METRICS,
		phases: [],
		allPhasesPassed: null,
	};

	const publish = (patch: Partial<ModelBenchmarkStreamState>) => {
		Object.assign(state, patch);
		callbacks.onUpdate(patch);
	};

	const rebuildMessages = () => {
		const messages: UIMessage[] = [];
		for (const runState of runStates.values()) {
			messages.push(...runState.messages);
		}
		return messages;
	};

	const publishBenchmarkMetrics = (finishedAtMs?: number) => {
		const benchmarkMetrics = buildBenchmarkPerfMetrics({
			phases: state.phases,
			jobStartedAtMs: testStartedAtMs,
			jobFinishedAtMs: finishedAtMs ?? Date.now(),
			firstTokenAtMs: jobFirstTokenAtMs,
			lastTokenAtMs: jobLastTokenAtMs,
			generationEndedAtMs: jobGenerationEndedAtMs,
			totalCompletionTokens:
				totalCompletionTokens > 0 ? totalCompletionTokens : null,
		});
		publish({ benchmarkMetrics });
		return benchmarkMetrics;
	};

	publish(state);

	await consumeJobStream(
		{
			url: "/api/test-model-benchmark",
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
					const patch: Partial<ModelBenchmarkStreamState> = {};
					if (data.percent != null) patch.progress = data.percent;
					if (data.step) patch.step = data.step;

					const phaseMetrics = parseBenchmarkPhaseMetrics(
						data.meta?.phaseMetrics,
					);
					if (phaseMetrics) {
						const phases = [...state.phases];
						const enrichedPhaseMetrics = data.agentRunId
							? { ...phaseMetrics, agentRunId: data.agentRunId }
							: phaseMetrics;
						const index = phases.findIndex(
							(candidate) =>
								candidate.phaseId === enrichedPhaseMetrics.phaseId,
						);
						if (index === -1) {
							phases.push(enrichedPhaseMetrics);
						} else {
							phases[index] = enrichedPhaseMetrics;
						}
						patch.phases = phases;
					}

					const benchmarkMetrics = parseBenchmarkPerfMetrics(
						data.meta?.benchmarkMetrics,
					);
					if (benchmarkMetrics) {
						patch.benchmarkMetrics = benchmarkMetrics;
					}

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
						runStates.set(
							data.agentRunId,
							createAgentRunState({
								agentRunId: data.agentRunId,
								label: data.label,
								systemPrompt: data.systemPrompt,
								userPrompt: data.userPrompt,
							}),
						);
						phaseTimings.set(
							data.agentRunId,
							createBenchmarkPhaseTiming(Date.now()),
						);
					}

					const reducerEvent = agentRunEventToReducerEvent(data);
					if (reducerEvent) {
						const existing = runStates.get(data.agentRunId);
						if (existing) {
							if (reducerEvent.eventType === "text-chunk") {
								const now = Date.now();
								const timing = phaseTimings.get(data.agentRunId);
								if (timing) {
									noteBenchmarkPhaseTextDelta(timing, now);
								}
								if (jobFirstTokenAtMs == null) {
									jobFirstTokenAtMs = now;
								}
								jobLastTokenAtMs = now;
							}
							if (data.eventType === "tool-call") {
								const timing = phaseTimings.get(data.agentRunId);
								if (timing) {
									noteBenchmarkPhaseToolCall(timing, Date.now());
								}
							}
							if (data.eventType === "tool-result") {
								const timing = phaseTimings.get(data.agentRunId);
								if (timing) {
									noteBenchmarkPhaseToolResult(timing, Date.now());
								}
							}

							runStates.set(
								data.agentRunId,
								reduceAgentEvent(existing, reducerEvent),
							);
							publish({ messages: rebuildMessages() });
						}
					}

					const tokenTotals = extractUsageTokenTotals(data);
					if (tokenTotals) {
						jobGenerationEndedAtMs = Date.now();
						totalCompletionTokens += tokenTotals.completion;
						const merged = mergeTokenTotals(state.tokenTotals, tokenTotals);
						publish({
							tokenTotals: merged,
							messages: rebuildMessages(),
						});
						publishBenchmarkMetrics();
					}

					if (data.eventType === "result" && data.meta?.benchmarkPhase) {
						const phaseMetrics = parseBenchmarkPhaseMetrics(
							data.meta.benchmarkPhase,
						);
						if (phaseMetrics) {
							const enrichedPhaseMetrics = {
								...phaseMetrics,
								agentRunId: phaseMetrics.agentRunId ?? data.agentRunId,
							};
							const phases = [...state.phases];
							const index = phases.findIndex(
								(candidate) =>
									candidate.phaseId === enrichedPhaseMetrics.phaseId,
							);
							if (index === -1) {
								phases.push(enrichedPhaseMetrics);
							} else {
								phases[index] = enrichedPhaseMetrics;
							}
							publish({ phases });
							publishBenchmarkMetrics();
						}
					}

					return;
				}

				if (part.type === "data-job-result") {
					const data = part.data as JobResultDataPart;
					const benchmarkMetrics = parseBenchmarkPerfMetrics(
						data.benchmarkMetrics,
					);
					if (benchmarkMetrics) {
						publish({ benchmarkMetrics });
					}
					if (Array.isArray(data.phases)) {
						publish({
							phases: data.phases as BenchmarkPhaseMetrics[],
						});
					}
					if (typeof data.allPhasesPassed === "boolean") {
						publish({ allPhasesPassed: data.allPhasesPassed });
					}
				}
			},
		},
	);

	const finishedAtMs = Date.now();
	const benchmarkMetrics = parseBenchmarkPerfMetrics(
		state.benchmarkMetrics,
	) ?? publishBenchmarkMetrics(finishedAtMs);

	publish({
		progress: 100,
		step: "Completed",
		messages: rebuildMessages(),
		benchmarkMetrics,
		allPhasesPassed: state.allPhasesPassed ?? false,
	});

	return {
		messages: state.messages,
		tokenTotals: state.tokenTotals,
		benchmarkMetrics,
		phases: state.phases,
		allPhasesPassed: state.allPhasesPassed ?? false,
	};
}
