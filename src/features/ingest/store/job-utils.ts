import type { UIMessage } from "ai";
import { pickRicherToolResultContent } from "@/features/ai/core/ai-stream-handler";
import type {
	FlowStage,
	IngestAgentEvent,
	IngestAgentRun,
	IngestAgentStatus,
	IngestChunkEvent,
	IngestJob,
	IngestLogLevel,
	IngestOutputEntry,
	IngestStageEvent,
	IngestTokenEvent,
	IngestWarningEvent,
	TokenTotals,
} from "./types";
import { createEmptyTotals } from "./types";

let entryCounter = 0;

function generateEntryId(prefix: string): string {
	return `${prefix}_${Date.now()}_${entryCounter++}`;
}

export function createEmptyJob(
	id: string,
	fileName: string,
	buffer: number[],
	enableReview: boolean,
	enableExplanations = true,
	agentConcurrency = 10,
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
		enableExplanations,
		agentConcurrency,
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

function appendOutputEntry(
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

function resolveNextAgentStatus(
	existingStatus: IngestAgentStatus | undefined,
	eventStatus: string | undefined,
	hasExistingWarnings: boolean,
): IngestAgentStatus {
	const normalizedEventStatus =
		eventStatus == null ? existingStatus : normalizeAgentStatus(eventStatus);

	if (existingStatus === "error") {
		return "error";
	}

	if (
		(existingStatus === "warning" || hasExistingWarnings) &&
		normalizedEventStatus === "done"
	) {
		return "warning";
	}

	return normalizedEventStatus ?? "running";
}

type AgentRole = "system" | "user" | "assistant";
type DynamicToolPart = Extract<
	UIMessage["parts"][number],
	{ type: "dynamic-tool" }
>;

function createTextPart(text: string) {
	return { type: "text" as const, text };
}

function createReasoningPart(text: string) {
	return { type: "reasoning" as const, text };
}

function createAgentMessage(
	agentRunId: string,
	role: AgentRole,
	content: string,
): UIMessage {
	return {
		id: `${agentRunId}:${role}`,
		role,
		parts: [createTextPart(content)],
	};
}

function createAgentMessages(
	agentRunId: string,
	systemPrompt: string,
	userPrompt: string,
	assistantText: string,
): UIMessage[] {
	const messages: UIMessage[] = [];
	if (systemPrompt) {
		messages.push(createAgentMessage(agentRunId, "system", systemPrompt));
	}
	if (userPrompt) {
		messages.push(createAgentMessage(agentRunId, "user", userPrompt));
	}
	messages.push(createAgentMessage(agentRunId, "assistant", assistantText));
	return messages;
}

function getAssistantMessageIndex(messages: UIMessage[]): number {
	return messages.findIndex((message) => message.role === "assistant");
}

function stripStructuredToolTranscript(text: string): string {
	const markerIndex = text.indexOf("TOOL CALL:");
	if (markerIndex === -1) return text;

	const lineStart = text.lastIndexOf("\n", markerIndex);
	const cutIndex = lineStart === -1 ? markerIndex : lineStart;
	return text.slice(0, cutIndex).trimEnd();
}

function stripToolTranscriptFromTextParts(
	parts: UIMessage["parts"],
): UIMessage["parts"] {
	let didStrip = false;

	return parts
		.map((part) => {
			if (part.type !== "text" || didStrip) return part;
			const text = part.text;
			const strippedContent = stripStructuredToolTranscript(text);
			if (strippedContent === text) return part;
			didStrip = true;
			return { ...part, text: strippedContent };
		})
		.filter((part, index, allParts) => {
			if (part.type !== "text") return true;
			if (part.text.length > 0) return true;
			return (
				allParts.some((candidate) => candidate.type !== "text") || index !== 0
			);
		});
}

function hasMeaningfulAssistantParts(parts: UIMessage["parts"]): boolean {
	return parts.some((part) =>
		part.type === "text" ? part.text.length > 0 : true,
	);
}

function updateTrailingTextPart(
	parts: UIMessage["parts"],
	chunk: string,
): UIMessage["parts"] {
	const nextParts = [...parts];
	const lastPart = nextParts.at(-1);

	if (lastPart?.type === "text") {
		nextParts[nextParts.length - 1] = {
			...lastPart,
			text: `${lastPart.text}${chunk}`,
		};
		return nextParts;
	}

	return [...nextParts, createTextPart(chunk)];
}

function upsertMessageText(
	agentRunId: string,
	messages: UIMessage[],
	role: AgentRole,
	content: string,
): UIMessage[] {
	const messageIndex = messages.findIndex((message) => message.role === role);
	if (messageIndex === -1) {
		return [...messages, createAgentMessage(agentRunId, role, content)];
	}

	const nextMessages = [...messages];
	const currentParts = nextMessages[messageIndex].parts;
	const nextParts = currentParts.some((part) => part.type === "text")
		? currentParts.map((part, index) =>
				part.type === "text" &&
				index ===
					currentParts.findIndex((candidate) => candidate.type === "text")
					? { ...part, text: content }
					: part,
			)
		: [createTextPart(content), ...currentParts];
	nextMessages[messageIndex] = {
		...nextMessages[messageIndex],
		parts: nextParts,
	};
	return nextMessages;
}

function createMissingAgentMessages(agentRun: IngestAgentRun): UIMessage[] {
	return createAgentMessages(
		agentRun.id,
		agentRun.systemPrompt,
		agentRun.userPrompt,
		agentRun.outputText,
	);
}

export function ensureAgentRunMessages(
	agentRun: IngestAgentRun,
): IngestAgentRun {
	if (Array.isArray(agentRun.messages) && agentRun.messages.length > 0) {
		return agentRun;
	}
	return {
		...agentRun,
		messages: createMissingAgentMessages(agentRun),
	};
}

function withAssistantMessage(
	agentRun: IngestAgentRun,
	update: (message: UIMessage) => UIMessage,
): IngestAgentRun {
	const normalizedAgentRun = ensureAgentRunMessages(agentRun);
	const messageIndex = getAssistantMessageIndex(normalizedAgentRun.messages);
	if (messageIndex === -1) return normalizedAgentRun;

	const nextMessages = [...normalizedAgentRun.messages];
	nextMessages[messageIndex] = update(nextMessages[messageIndex]);

	return {
		...normalizedAgentRun,
		messages: nextMessages,
	};
}

function updateTrailingReasoningPart(
	parts: UIMessage["parts"],
	chunk: string,
): UIMessage["parts"] {
	const nextParts = [...parts];
	const lastPart = nextParts.at(-1);

	if (lastPart?.type === "reasoning") {
		nextParts[nextParts.length - 1] = {
			...lastPart,
			text: `${lastPart.text}${chunk}`,
		};
		return nextParts;
	}

	return [...nextParts, createReasoningPart(chunk)];
}

function appendAssistantTextMessage(
	agentRun: IngestAgentRun,
	chunk: string,
): IngestAgentRun {
	return withAssistantMessage(agentRun, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];

		return {
			...message,
			parts: updateTrailingTextPart(baseParts, chunk),
		};
	});
}

function appendAssistantThinkingMessage(
	agentRun: IngestAgentRun,
	chunk: string,
): IngestAgentRun {
	return withAssistantMessage(agentRun, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];

		return {
			...message,
			parts: updateTrailingReasoningPart(baseParts, chunk),
		};
	});
}

function syncPromptsIntoMessages(agentRun: IngestAgentRun): IngestAgentRun {
	const nextAgentRun = ensureAgentRunMessages(agentRun);
	const withSystem = upsertMessageText(
		nextAgentRun.id,
		nextAgentRun.messages,
		"system",
		nextAgentRun.systemPrompt,
	);
	const withUser = upsertMessageText(
		nextAgentRun.id,
		withSystem,
		"user",
		nextAgentRun.userPrompt,
	);
	const assistantText =
		nextAgentRun.outputText.length > 0
			? nextAgentRun.outputText
			: readAssistantText(nextAgentRun.messages);
	const assistantMessage = withUser.find(
		(message) => message.role === "assistant",
	);

	return {
		...nextAgentRun,
		messages:
			assistantMessage && hasMeaningfulAssistantParts(assistantMessage.parts)
				? withUser
				: upsertMessageText(
						nextAgentRun.id,
						withUser,
						"assistant",
						assistantText,
					),
	};
}

function readAssistantText(messages: UIMessage[]): string {
	const assistant = messages.find((message) => message.role === "assistant");
	if (!assistant) return "";
	return assistant.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
}

function safeJsonString(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function normalizeDynamicToolInputState(
	value: unknown,
): Extract<DynamicToolPart["state"], `input${string}` | `approval${string}`> {
	switch (value) {
		case "input-streaming":
		case "input-available":
		case "approval-requested":
		case "approval-responded":
			return value;
		case "awaiting-input":
		case "input-complete":
			return "input-available";
		default:
			return "input-available";
	}
}

function normalizeDynamicToolOutputState(
	value: unknown,
	error?: string,
): Extract<
	DynamicToolPart["state"],
	`output${string}` | "input-available"
> {
	if (typeof error === "string" && error.length > 0) {
		return "output-error";
	}
	switch (value) {
		case "output-available":
		case "output-error":
		case "output-denied":
			return value;
		case "streaming":
		case "complete":
		case "completed":
			return "output-available";
		case "error":
			return "output-error";
		default:
			return "output-available";
	}
}

function readLatestToolCallId(agentRun: IngestAgentRun): string | undefined {
	const normalizedAgentRun = ensureAgentRunMessages(agentRun);
	const assistant = normalizedAgentRun.messages.find(
		(message) => message.role === "assistant",
	);
	if (!assistant) return undefined;

	for (let index = assistant.parts.length - 1; index >= 0; index -= 1) {
		const part = assistant.parts[index];
		if (part.type === "dynamic-tool") {
			return part.toolCallId;
		}
	}

	return undefined;
}

function createToolCallId(
	agentRun: IngestAgentRun,
	event: IngestAgentEvent,
): string {
	const meta = event.meta as Record<string, unknown> | undefined;
	const candidate = meta?.toolCallId ?? meta?.id;
	if (typeof candidate === "string" && candidate.length > 0) {
		return candidate;
	}

	const existingCount = ensureAgentRunMessages(agentRun)
		.messages.find((message) => message.role === "assistant")
		?.parts.filter((part) => part.type === "dynamic-tool").length;

	return `${agentRun.id}:tool-call:${existingCount ?? 0}`;
}

function isMeaningfulToolValue(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]";
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (typeof value === "object") {
		return Object.keys(value as Record<string, unknown>).length > 0;
	}
	return true;
}

function readToolResultOutput(event: IngestAgentEvent): unknown {
	const eventRecord = event as IngestAgentEvent & { result?: unknown };
	return event.content ?? event.output ?? eventRecord.result ?? "";
}

function isMeaningfulToolResultOutput(output: unknown): boolean {
	if (output == null) return false;
	if (typeof output === "string") {
		const trimmed = output.trim();
		return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]";
	}
	if (Array.isArray(output)) return output.length > 0;
	if (typeof output === "object") {
		return Object.keys(output as Record<string, unknown>).length > 0;
	}
	return true;
}

function mergeDynamicToolOutput(
	existing: unknown,
	incoming: unknown,
): unknown {
	const existingText =
		typeof existing === "string" ? existing : safeJsonString(existing);
	const incomingText =
		typeof incoming === "string" ? incoming : safeJsonString(incoming);
	if (!isMeaningfulToolResultOutput(incoming)) return existing;
	if (!isMeaningfulToolResultOutput(existing)) return incoming;
	return pickRicherToolResultContent(existingText, incomingText);
}

function createDynamicToolFromCallEvent(
	agentRun: IngestAgentRun,
	event: IngestAgentEvent,
): DynamicToolPart {
	return {
		type: "dynamic-tool",
		toolCallId: createToolCallId(agentRun, event),
		toolName: typeof event.name === "string" ? event.name : "unknown_tool",
		state: normalizeDynamicToolInputState(event.state),
		input: isMeaningfulToolValue(event.input)
			? event.input
			: tryParseJson(event.arguments) ?? {},
	} as DynamicToolPart;
}

function tryParseJson(value: string | undefined): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function createDynamicToolFromResultEvent(
	agentRun: IngestAgentRun,
	event: IngestAgentEvent,
): DynamicToolPart {
	const meta = event.meta as Record<string, unknown> | undefined;
	const candidate = meta?.toolCallId;
	const toolCallId =
		typeof candidate === "string" && candidate.length > 0
			? candidate
			: (readLatestToolCallId(agentRun) ?? `${agentRun.id}:tool-call:0`);
	const output = readToolResultOutput(event);
	const errorText = typeof event.error === "string" ? event.error : undefined;

	return {
		type: "dynamic-tool",
		toolCallId,
		toolName: typeof event.name === "string" ? event.name : "unknown_tool",
		state: normalizeDynamicToolOutputState(event.state, errorText),
		input: event.input ?? {},
		output: isMeaningfulToolResultOutput(output) ? output : undefined,
		errorText,
	} as DynamicToolPart;
}

function mergeDynamicToolPart(
	existing: DynamicToolPart,
	incoming: DynamicToolPart,
): DynamicToolPart {
	const mergedOutput = mergeDynamicToolOutput(existing.output, incoming.output);
	const nextState =
		incoming.state === "output-available" ||
		incoming.state === "output-error" ||
		incoming.state === "output-denied"
			? incoming.state
			: existing.state === "output-available" ||
					existing.state === "output-error" ||
					existing.state === "output-denied"
				? existing.state
				: normalizeDynamicToolInputState(incoming.state ?? existing.state);

	return {
		...existing,
		...incoming,
		toolName:
			incoming.toolName.length > 0 ? incoming.toolName : existing.toolName,
		input: isMeaningfulToolValue(incoming.input)
			? incoming.input
			: existing.input,
		output: mergedOutput,
		errorText: incoming.errorText ?? existing.errorText,
		state: nextState,
	} as DynamicToolPart;
}

function upsertDynamicToolPart(
	parts: UIMessage["parts"],
	toolPart: DynamicToolPart,
): UIMessage["parts"] {
	const existingIndex = parts.findIndex(
		(candidate) =>
			candidate.type === "dynamic-tool" &&
			candidate.toolCallId === toolPart.toolCallId,
	);

	if (existingIndex === -1) {
		if (
			toolPart.state === "output-available" &&
			!isMeaningfulToolResultOutput(toolPart.output)
		) {
			return parts;
		}
		return [...parts, toolPart];
	}

	const current = parts[existingIndex];
	if (current.type !== "dynamic-tool") return parts;

	const nextParts = [...parts];
	nextParts[existingIndex] = mergeDynamicToolPart(current, toolPart);
	return nextParts;
}

function appendAssistantToolPart(
	agentRun: IngestAgentRun,
	toolPart: DynamicToolPart,
): IngestAgentRun {
	return withAssistantMessage(agentRun, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];
		const nextParts = stripToolTranscriptFromTextParts(baseParts);

		return {
			...message,
			parts: upsertDynamicToolPart(nextParts, toolPart),
		};
	});
}

export function appendToolCallToAgentRun(
	job: IngestJob,
	event: IngestAgentEvent,
): IngestJob {
	if (!event.agentRunId) return job;
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === event.agentRunId,
	);
	if (existingIndex === -1) return job;

	const nextAgentRuns = [...job.agentRuns];
	nextAgentRuns[existingIndex] = appendAssistantToolPart(
		nextAgentRuns[existingIndex],
		createDynamicToolFromCallEvent(nextAgentRuns[existingIndex], event),
	);

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
}

export function appendToolResultToAgentRun(
	job: IngestJob,
	event: IngestAgentEvent,
): IngestJob {
	if (!event.agentRunId) return job;
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === event.agentRunId,
	);
	if (existingIndex === -1) return job;

	const nextAgentRuns = [...job.agentRuns];
	nextAgentRuns[existingIndex] = appendAssistantToolPart(
		nextAgentRuns[existingIndex],
		createDynamicToolFromResultEvent(nextAgentRuns[existingIndex], event),
	);

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
}

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
	if (!event.agentRunId) {
		return job;
	}

	const timestamp = event.timestamp ?? Date.now();
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === event.agentRunId,
	);

	if (existingIndex === -1) {
		const tokenTotals = extractTokenTotals(event.tokens) ?? createEmptyTotals();
		const systemPrompt = event.systemPrompt ?? "";
		const userPrompt = event.userPrompt ?? "";
		const outputText = event.rawText ?? "";
		const status = resolveNextAgentStatus(
			undefined,
			event.status,
			Boolean(event.warning),
		);
		return {
			...job,
			agentRuns: [
				...job.agentRuns.filter(
					(agentRun) => agentRun.id !== event.agentRunId,
				),
				{
					id: event.agentRunId,
					stageId: event.stageId,
					label: event.label,
					status,
					timestamp,
					messages: createAgentMessages(
						event.agentRunId,
						systemPrompt,
						userPrompt,
						outputText,
					),
					systemPrompt,
					userPrompt,
					outputText,
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
	const existing = ensureAgentRunMessages(nextAgentRuns[existingIndex]);
	const tokenTotals = extractTokenTotals(event.tokens);
	const nextOutputText =
		existing.outputText.length > 0
			? existing.outputText
			: (event.rawText ?? existing.outputText);
	const nextWarnings = event.warning
		? [...existing.warnings, event.warning]
		: existing.warnings;
	const status = resolveNextAgentStatus(
		existing.status,
		event.status,
		nextWarnings.length > 0,
	);
	nextAgentRuns[existingIndex] = syncPromptsIntoMessages({
		...existing,
		stageId: event.stageId,
		label: event.label,
		status,
		timestamp,
		systemPrompt: event.systemPrompt ?? existing.systemPrompt,
		userPrompt: event.userPrompt ?? existing.userPrompt,
		outputText: nextOutputText,
		rawOutput: event.finalObject ?? event.rawText ?? existing.rawOutput,
		error: event.error ?? existing.error,
		warnings: nextWarnings,
		tokenTotals: tokenTotals ?? existing.tokenTotals,
		meta: event.meta ?? existing.meta,
	});

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

export function appendReasoningToAgentRun(
	job: IngestJob,
	agentRunId: string,
	chunk: string,
): IngestJob {
	const existingIndex = job.agentRuns.findIndex(
		(agentRun) => agentRun.id === agentRunId,
	);
	if (existingIndex === -1) return job;

	const nextAgentRuns = [...job.agentRuns];
	nextAgentRuns[existingIndex] = appendAssistantThinkingMessage(
		nextAgentRuns[existingIndex],
		chunk,
	);

	return {
		...job,
		agentRuns: nextAgentRuns,
	};
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
	const nextAgentRun = ensureAgentRunMessages(nextAgentRuns[existingIndex]);
	nextAgentRuns[existingIndex] = appendAssistantTextMessage(
		{
			...nextAgentRun,
			outputText: `${nextAgentRun.outputText}${chunk}`,
		},
		chunk,
	);

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
