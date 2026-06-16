import type {
	AgentRunDataPart,
	JobProgressDataPart,
	JobResultDataPart,
	StageDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import type {
	FlowStage,
	IngestAgentRun,
	IngestAgentStatus,
	IngestResultEvent,
	TokenTotals,
} from "@/features/ingest/store/types";
import { createEmptyTotals } from "@/features/ingest/store/types";
import {
	type AgentRunState,
	applyAgentRunPart,
	createSingleAgentRunState,
} from "./single-agent-run-reducer";

export interface IngestPipelineState {
	stages: FlowStage[];
	agentRuns: IngestAgentRun[];
	stepText: string;
	progress: number | null;
	result: IngestResultEvent | null;
	tokenTotals: TokenTotals;
	nonAgentTokenTotals: TokenTotals;
	warnings: string[];
}

interface IngestAgentRunMeta {
	stageId: string;
	timestamp: number;
	rawOutput: unknown;
	tokenTotals: TokenTotals;
	meta?: Record<string, unknown>;
}

export function createIngestPipelineState(): IngestPipelineState {
	return {
		stages: [],
		agentRuns: [],
		stepText: "",
		progress: null,
		result: null,
		tokenTotals: createEmptyTotals(),
		nonAgentTokenTotals: createEmptyTotals(),
		warnings: [],
	};
}

interface IngestReducerInternals {
	runStates: Map<string, AgentRunState>;
	runMeta: Map<string, IngestAgentRunMeta>;
}

function createInternals(): IngestReducerInternals {
	return {
		runStates: new Map(),
		runMeta: new Map(),
	};
}

function normalizeStageStatus(status: string): FlowStage["status"] {
	switch (status) {
		case "pending":
		case "running":
		case "done":
		case "warning":
		case "error":
		case "skipped":
			return status;
		default:
			return "running";
	}
}

function normalizeAgentStatus(
	status: SingleAgentRunStatusish,
): IngestAgentStatus {
	switch (status) {
		case "pending":
		case "running":
		case "done":
		case "error":
			return status;
		default:
			return "running";
	}
}

type SingleAgentRunStatusish = AgentRunState["status"] | string;

function extractTokenTotals(value: unknown): TokenTotals | null {
	if (typeof value !== "object" || value === null) return null;
	const tokenValue = value as Record<string, unknown>;
	const prompt =
		typeof tokenValue.prompt === "number"
			? tokenValue.prompt
			: typeof tokenValue.promptTokens === "number"
				? tokenValue.promptTokens
				: typeof tokenValue.inputTokens === "number"
					? tokenValue.inputTokens
					: undefined;
	const completion =
		typeof tokenValue.completion === "number"
			? tokenValue.completion
			: typeof tokenValue.completionTokens === "number"
				? tokenValue.completionTokens
				: typeof tokenValue.outputTokens === "number"
					? tokenValue.outputTokens
					: undefined;
	const total =
		typeof tokenValue.total === "number"
			? tokenValue.total
			: typeof tokenValue.totalTokens === "number"
				? tokenValue.totalTokens
				: prompt != null && completion != null
					? prompt + completion
					: undefined;

	if (prompt == null && completion == null && total == null) {
		return null;
	}

	return {
		prompt: prompt ?? 0,
		completion: completion ?? 0,
		total: total ?? (prompt ?? 0) + (completion ?? 0),
	};
}

function sumAgentTokenTotals(agentRuns: IngestAgentRun[]): TokenTotals {
	return agentRuns.reduce(
		(totals, agentRun) => ({
			prompt: totals.prompt + agentRun.tokenTotals.prompt,
			completion: totals.completion + agentRun.tokenTotals.completion,
			total: totals.total + agentRun.tokenTotals.total,
		}),
		createEmptyTotals(),
	);
}

function syncTokenTotals(state: IngestPipelineState): IngestPipelineState {
	const agentTotals = sumAgentTokenTotals(state.agentRuns);
	return {
		...state,
		tokenTotals: {
			prompt: agentTotals.prompt + state.nonAgentTokenTotals.prompt,
			completion: agentTotals.completion + state.nonAgentTokenTotals.completion,
			total: agentTotals.total + state.nonAgentTokenTotals.total,
		},
	};
}

function agentRunStateToIngest(
	runState: AgentRunState,
	meta: IngestAgentRunMeta,
): IngestAgentRun {
	return {
		id: runState.agentRunId,
		stageId: meta.stageId,
		label: runState.label,
		status: normalizeAgentStatus(runState.status),
		timestamp: meta.timestamp,
		systemPrompt: runState.systemPrompt,
		userPrompt: runState.userPrompt,
		messages: runState.messages,
		outputText: runState.outputText,
		rawOutput: meta.rawOutput,
		error: runState.error,
		warnings: [...runState.warnings],
		tokenTotals: meta.tokenTotals,
		meta: meta.meta,
	};
}

function rebuildAgentRuns(internals: IngestReducerInternals): IngestAgentRun[] {
	const agentRuns: IngestAgentRun[] = [];
	for (const [agentRunId, runState] of internals.runStates) {
		const meta = internals.runMeta.get(agentRunId);
		if (!meta) continue;
		agentRuns.push(agentRunStateToIngest(runState, meta));
	}
	return agentRuns;
}

function ensureRunState(
	internals: IngestReducerInternals,
	data: AgentRunDataPart,
): AgentRunState {
	const existing = internals.runStates.get(data.agentRunId);
	if (existing) return existing;

	const created = createSingleAgentRunState({
		agentRunId: data.agentRunId,
		label: data.label,
		systemPrompt: data.systemPrompt,
		userPrompt: data.userPrompt,
	});
	internals.runStates.set(data.agentRunId, created);
	internals.runMeta.set(data.agentRunId, {
		stageId: data.stageId,
		timestamp: data.timestamp ?? Date.now(),
		rawOutput: data.finalObject ?? data.rawText ?? null,
		tokenTotals: extractTokenTotals(data.tokens) ?? createEmptyTotals(),
		meta: data.meta,
	});
	return created;
}

function updateRunMeta(
	internals: IngestReducerInternals,
	data: AgentRunDataPart,
): void {
	const meta = internals.runMeta.get(data.agentRunId) ?? {
		stageId: data.stageId,
		timestamp: data.timestamp ?? Date.now(),
		rawOutput: null,
		tokenTotals: createEmptyTotals(),
		meta: data.meta,
	};

	const tokenTotals = extractTokenTotals(data.tokens) ?? meta.tokenTotals;
	internals.runMeta.set(data.agentRunId, {
		stageId: data.stageId,
		timestamp: data.timestamp ?? meta.timestamp,
		rawOutput: data.finalObject ?? data.rawText ?? meta.rawOutput,
		tokenTotals,
		meta: data.meta ?? meta.meta,
	});
}

function readJobResult(data: JobResultDataPart): IngestResultEvent {
	const record = data as Record<string, unknown>;
	const questions =
		typeof record.questions === "number"
			? record.questions
			: Array.isArray(record.questions)
				? record.questions.length
				: 0;
	const topics = Array.isArray(record.topics)
		? record.topics.filter(
				(topic): topic is string => typeof topic === "string",
			)
		: [];
	return {
		questions,
		topics,
		examId: typeof record.examId === "number" ? record.examId : undefined,
		fileId: typeof record.fileId === "number" ? record.fileId : undefined,
	};
}

import type { RunJobPipelineHandlers } from "./run-job-pipeline";

export interface IngestPipelineReducer {
	getState: () => IngestPipelineState;
	applyStage: (data: StageDataPart) => IngestPipelineState;
	applyProgress: (data: JobProgressDataPart) => IngestPipelineState;
	applyAgentRun: (data: AgentRunDataPart) => IngestPipelineState;
	applyResult: (data: JobResultDataPart) => IngestPipelineState;
	applyWarning: (message: string) => IngestPipelineState;
}

export function createIngestPipelineReducer(
	initialState: IngestPipelineState = createIngestPipelineState(),
): IngestPipelineReducer {
	let state = initialState;
	const internals = createInternals();

	const publish = (): IngestPipelineState => {
		state = syncTokenTotals({
			...state,
			agentRuns: rebuildAgentRuns(internals),
		});
		return state;
	};

	return {
		getState: () => state,
		applyStage(data) {
			const normalizedStatus = normalizeStageStatus(data.status);
			const existingIndex = state.stages.findIndex(
				(stage) => stage.stageId === data.stageId,
			);
			const nextStage: FlowStage = {
				stageId: data.stageId,
				label: data.label,
				status: normalizedStatus,
				timestamp: data.timestamp ?? Date.now(),
				meta: data.meta,
			};

			if (existingIndex === -1) {
				state = { ...state, stages: [...state.stages, nextStage] };
			} else {
				const stages = [...state.stages];
				stages[existingIndex] = nextStage;
				state = { ...state, stages };
			}
			return publish();
		},
		applyProgress(data) {
			state = {
				...state,
				stepText: data.step ?? state.stepText,
				progress: data.percent ?? state.progress,
			};
			return state;
		},
		applyAgentRun(data) {
			const current = ensureRunState(internals, data);
			const next = applyAgentRunPart(current, data);
			internals.runStates.set(data.agentRunId, next);
			updateRunMeta(internals, data);

			if (data.eventType === "warning" && data.warning) {
				state = {
					...state,
					warnings: [...state.warnings, data.warning],
				};
			}

			return publish();
		},
		applyResult(data) {
			state = {
				...state,
				result: readJobResult(data),
			};
			return state;
		},
		applyWarning(message) {
			state = {
				...state,
				warnings: [...state.warnings, message],
			};
			return state;
		},
	};
}

export function ingestPipelineReducerHandlers(
	reducer: IngestPipelineReducer,
): Pick<
	RunJobPipelineHandlers,
	"onStage" | "onProgress" | "onAgentRun" | "onResult"
> {
	return {
		onStage(_ctx, data) {
			reducer.applyStage(data);
		},
		onProgress(_ctx, data) {
			reducer.applyProgress(data);
		},
		onAgentRun(_ctx, data) {
			reducer.applyAgentRun(data);
		},
		onResult(_ctx, data) {
			reducer.applyResult(data);
		},
	};
}
