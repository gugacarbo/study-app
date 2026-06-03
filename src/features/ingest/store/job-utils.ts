import type {
	IngestAgentEvent,
	IngestChunkEvent,
	IngestStageEvent,
	IngestTokenEvent,
	IngestWarningEvent,
} from "@/lib/sse-stream";
import type {
	FlowStage,
	IngestAgentRun,
	IngestAgentStatus,
	IngestJob,
	IngestLogLevel,
	IngestOutputEntry,
	TokenTotals,
} from "./types";
import { createEmptyTotals } from "./types";

let entryCounter = 0;

export function generateEntryId(prefix: string): string {
	return `${prefix}_${Date.now()}_${entryCounter++}`;
}

export function createEmptyJob(
	id: string,
	fileName: string,
	buffer: number[],
	enableReview: boolean,
): IngestJob {
	return {
		id,
		fileName,
		status: "queued",
		createdAt: Date.now(),
		startedAt: null,
		finishedAt: null,
		stepText: "",
		logs: [],
		outputEntries: [],
		agentRuns: [],
		tokenTotals: createEmptyTotals(),
		nonAgentTokenTotals: createEmptyTotals(),
		warnings: [],
		result: null,
		error: null,
		flowStages: [],
		buffer,
		enableReview,
		rawStreamText: "",
	};
}

export function appendLogEntry(
	job: IngestJob,
	message: string,
	options?: {
		timestamp?: number;
		stageId?: string | null;
		agentRunId?: string | null;
		level?: IngestLogLevel;
	},
): IngestJob {
	return {
		...job,
		logs: [
			...job.logs,
			{
				id: generateEntryId("log"),
				timestamp: options?.timestamp ?? Date.now(),
				stageId: options?.stageId ?? null,
				agentRunId: options?.agentRunId ?? null,
				level: options?.level ?? "info",
				message,
			},
		],
	};
}

export function appendOutputEntry(
	job: IngestJob,
	entry: {
		stageId?: string | null;
		agentRunId?: string | null;
		text: string;
		timestamp?: number;
		kind?: IngestOutputEntry["kind"];
	},
): IngestJob {
	return {
		...job,
		outputEntries: [
			...job.outputEntries,
			{
				id: generateEntryId("output"),
				stageId: entry.stageId ?? null,
				agentRunId: entry.agentRunId ?? null,
				text: entry.text,
				timestamp: entry.timestamp ?? Date.now(),
				kind: entry.kind ?? "chunk",
			},
		],
	};
}

function normalizeStageStatus(status: string): FlowStage["status"] {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "warning" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}

function normalizeAgentStatus(status?: string): IngestAgentStatus {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "warning" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}

export function extractTokenTotals(value: unknown): TokenTotals | null {
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

export function syncJobTokenTotals(job: IngestJob): IngestJob {
	const agentTotals = sumAgentTokenTotals(job.agentRuns);

	return {
		...job,
		tokenTotals: {
			prompt: agentTotals.prompt + job.nonAgentTokenTotals.prompt,
			completion: agentTotals.completion + job.nonAgentTokenTotals.completion,
			total: agentTotals.total + job.nonAgentTokenTotals.total,
		},
	};
}

export function upsertAgentRun(
	job: IngestJob,
	event: IngestAgentEvent,
): IngestJob {
	const timestamp = event.timestamp ?? Date.now();
	const status = normalizeAgentStatus(event.status);
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === event.agentRunId,
	);

	if (existingIndex === -1) {
		const tokenTotals = extractTokenTotals(event.tokens) ?? createEmptyTotals();
		return {
			...job,
			agentRuns: [
				...job.agentRuns,
				{
					id: event.agentRunId,
					stageId: event.stageId,
					label: event.label,
					status,
					timestamp,
					systemPrompt: event.systemPrompt ?? "",
					userPrompt: event.userPrompt ?? "",
					outputText: event.rawText ?? "",
					rawOutput: event.finalObject ?? event.rawText ?? null,
					error: event.error ?? null,
					warnings: event.warning ? [event.warning] : [],
					tokenTotals,
					meta: event.meta,
				},
			],
		};
	}

	const nextAgentRuns = [...job.agentRuns];
	const existing = nextAgentRuns[existingIndex];
	const tokenTotals = extractTokenTotals(event.tokens);
	nextAgentRuns[existingIndex] = {
		...existing,
		stageId: event.stageId,
		label: event.label,
		status,
		timestamp,
		systemPrompt: event.systemPrompt ?? existing.systemPrompt,
		userPrompt: event.userPrompt ?? existing.userPrompt,
		outputText:
			existing.outputText.length > 0
				? existing.outputText
				: (event.rawText ?? existing.outputText),
		rawOutput: event.finalObject ?? event.rawText ?? existing.rawOutput,
		error: event.error ?? existing.error,
		warnings: event.warning
			? [...existing.warnings, event.warning]
			: existing.warnings,
		tokenTotals: tokenTotals ?? existing.tokenTotals,
		meta: event.meta ?? existing.meta,
	};

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
}

function getFallbackStageId(
	job: IngestJob,
	preferred?: string | null,
): string | null {
	if (preferred) return preferred;

	const runningStage = [...job.flowStages]
		.reverse()
		.find((stage) => stage.status === "running");
	if (runningStage) return runningStage.stageId;

	return job.flowStages[job.flowStages.length - 1]?.stageId ?? null;
}

export function updateFlowStages(
	job: IngestJob,
	stage: IngestStageEvent,
): IngestJob {
	const normalizedStatus = normalizeStageStatus(stage.status);
	const existingIndex = job.flowStages.findIndex(
		(flowStage) => flowStage.stageId === stage.stageId,
	);

	if (existingIndex === -1) {
		return {
			...job,
			flowStages: [
				...job.flowStages,
				{
					stageId: stage.stageId,
					label: stage.label,
					status: normalizedStatus,
					timestamp: stage.timestamp,
					meta: stage.meta,
				},
			],
		};
	}

	const nextStages = [...job.flowStages];
	nextStages[existingIndex] = {
		stageId: stage.stageId,
		label: stage.label,
		status: normalizedStatus,
		timestamp: stage.timestamp,
		meta: stage.meta,
	};

	return {
		...job,
		flowStages: nextStages,
	};
}

export function applyChunkEvent(
	job: IngestJob,
	event?: IngestChunkEvent,
): IngestJob {
	if (!event?.text) return job;

	return appendOutputEntry(job, {
		stageId: getFallbackStageId(job, event.stageId ?? null),
		agentRunId: event.agentRunId ?? null,
		text: event.text,
		timestamp: event.timestamp,
	});
}

export function appendChunkToAgentRun(
	job: IngestJob,
	agentRunId: string,
	chunk: string,
): IngestJob {
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === agentRunId,
	);
	if (existingIndex === -1) return job;

	const nextAgentRuns = [...job.agentRuns];
	nextAgentRuns[existingIndex] = {
		...nextAgentRuns[existingIndex],
		outputText: `${nextAgentRuns[existingIndex].outputText}${chunk}`,
	};

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
}

export function applyWarningEvent(
	job: IngestJob,
	message: string,
	event?: IngestWarningEvent,
): IngestJob {
	const stageId = getFallbackStageId(job, event?.stageId ?? null);
	let nextJob = {
		...job,
		warnings: [...job.warnings, message],
	};

	nextJob = appendOutputEntry(nextJob, {
		stageId,
		agentRunId: event?.agentRunId ?? null,
		text: message,
		timestamp: event?.timestamp,
		kind: "warning",
	});
	nextJob = appendLogEntry(nextJob, message, {
		timestamp: event?.timestamp,
		stageId,
		agentRunId: event?.agentRunId ?? null,
		level: "warning",
	});

	if (!event?.agentRunId) {
		return nextJob;
	}
	const existingRun = nextJob.agentRuns.find(
		(agentRun) => agentRun.id === event.agentRunId,
	);

	const agentEvent: IngestAgentEvent = {
		agentRunId: event.agentRunId,
		stageId: stageId ?? "review",
		label: existingRun?.label ?? event.agentRunId,
		status: existingRun?.status === "error" ? "error" : "warning",
		timestamp: event.timestamp,
		warning: message,
	};

	return upsertAgentRun(nextJob, agentEvent);
}

export function applyTokenEvent(
	job: IngestJob,
	event: IngestTokenEvent,
): IngestJob {
	if (!event.agentRunId) {
		return {
			...job,
			tokenTotals: {
				prompt: job.tokenTotals.prompt + event.prompt,
				completion: job.tokenTotals.completion + event.completion,
				total: job.tokenTotals.total + event.total,
			},
			nonAgentTokenTotals: {
				prompt: job.nonAgentTokenTotals.prompt + event.prompt,
				completion: job.nonAgentTokenTotals.completion + event.completion,
				total: job.nonAgentTokenTotals.total + event.total,
			},
		};
	}

	return syncJobTokenTotals(
		upsertAgentRun(job, {
			agentRunId: event.agentRunId,
			stageId: getFallbackStageId(job, event.stageId ?? null) ?? "review",
			label: event.agentRunId,
			timestamp: event.timestamp,
			tokens: {
				prompt: event.prompt,
				completion: event.completion,
				total: event.total,
			},
		}),
	);
}
