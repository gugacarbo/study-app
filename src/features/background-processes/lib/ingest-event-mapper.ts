import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import {
	formatEventDetails,
	formatEventLabel,
	formatEventType,
	type IngestClientDataPart,
	type IngestEventType,
	type IngestStreamPartEvent,
	isIngestStreamPartEvent,
	messageForPayload,
	PHASE_LABELS,
	roleForPayload,
} from "@/features/background-processes/lib/ingest-event-labels";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import type { IngestPhase } from "@/lib/job-kinds";

type AssistantContentPart = Extract<
	ThreadMessageLike["content"],
	readonly unknown[]
>[number];

export type MappedThreadMessage = {
	id: string;
	role: "system" | "assistant";
	content: ThreadMessageLike["content"];
	seq: number;
	status?: "running" | "complete";
};

export type IngestProgressState = {
	phase: IngestPhase | null;
	questionsSeen: number;
	extracted: number | null;
	persisted: number | null;
	skippedDuplicate: number | null;
	invalid: number | null;
	extractedQuestionsPreview: {
		index: number;
		question: string;
		topic: string;
	}[];
};

export const INITIAL_INGEST_PROGRESS: IngestProgressState = {
	phase: null,
	questionsSeen: 0,
	extracted: null,
	persisted: null,
	skippedDuplicate: null,
	invalid: null,
	extractedQuestionsPreview: [],
};

export type StreamPartsState = Map<string, AssistantContentPart[]>;

export {
	formatEventDetails,
	formatEventLabel,
	formatEventType,
	type IngestEventType,
	type IngestStreamPartEvent,
};

function isIngestDataPart(payload: unknown): payload is IngestClientDataPart {
	if (!payload || typeof payload !== "object" || !("type" in payload)) {
		return false;
	}
	const type = (payload as { type: string }).type;
	return (
		type === INGEST_DATA_PART.PHASE ||
		type === INGEST_DATA_PART.STREAM_PROGRESS ||
		type === INGEST_DATA_PART.SKIPPED_DUPLICATE ||
		type === INGEST_DATA_PART.SUMMARY ||
		type === INGEST_DATA_PART.PERSIST_PROGRESS
	);
}

function parseArgsText(argsText: string): ReadonlyJSONObject {
	try {
		const parsed: unknown = JSON.parse(argsText);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as ReadonlyJSONObject;
		}
	} catch {
		// partial or invalid JSON while streaming
	}
	return {};
}

function findReasoningPartIndex(parts: AssistantContentPart[]): number {
	return parts.findIndex((part) => part.type === "reasoning");
}

function findToolCallPartIndex(
	parts: AssistantContentPart[],
	toolCallId: string,
): number {
	return parts.findIndex(
		(part) => part.type === "tool-call" && part.toolCallId === toolCallId,
	);
}

function findTextPartIndex(parts: AssistantContentPart[]): number {
	return parts.findIndex((part) => part.type === "text");
}

export function mergeStreamParts(
	state: StreamPartsState,
	event: IngestStreamPartEvent,
): StreamPartsState {
	const { messageId } = event;
	const parts = [...(state.get(messageId) ?? [])];
	const next = new Map(state);

	switch (event.type) {
		case "reasoning-delta": {
			const idx = findReasoningPartIndex(parts);
			if (idx >= 0) {
				const current = parts[idx];
				if (current.type === "reasoning") {
					parts[idx] = {
						type: "reasoning",
						text: current.text + event.delta,
					};
				}
			} else {
				parts.push({ type: "reasoning", text: event.delta });
			}
			break;
		}
		case "reasoning": {
			const idx = findReasoningPartIndex(parts);
			if (idx >= 0) {
				parts[idx] = { type: "reasoning", text: event.text };
			} else {
				parts.push({ type: "reasoning", text: event.text });
			}
			break;
		}
		case "tool-call": {
			const idx = findToolCallPartIndex(parts, event.toolCallId);
			const toolPart = {
				type: "tool-call" as const,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				argsText: event.argsText,
				args: parseArgsText(event.argsText),
			};
			if (idx >= 0) {
				const current = parts[idx];
				if (current.type === "tool-call") {
					parts[idx] = {
						...current,
						...toolPart,
						result: current.result,
						isError: current.isError,
					};
				}
			} else {
				parts.push(toolPart);
			}
			break;
		}
		case "tool-result": {
			const idx = findToolCallPartIndex(parts, event.toolCallId);
			if (idx >= 0) {
				const current = parts[idx];
				if (current.type === "tool-call") {
					parts[idx] = {
						...current,
						result: event.result,
						isError: event.isError,
					};
				}
			} else {
				parts.push({
					type: "tool-call",
					toolCallId: event.toolCallId,
					toolName: "unknown",
					argsText: "{}",
					args: {},
					result: event.result,
					isError: event.isError,
				});
			}
			break;
		}
		case "text": {
			const idx = findTextPartIndex(parts);
			if (idx >= 0) {
				const current = parts[idx];
				if (current.type === "text") {
					parts[idx] = {
						type: "text",
						text: current.text + event.text,
					};
				}
			} else {
				parts.push({ type: "text", text: event.text });
			}
			break;
		}
	}

	next.set(messageId, parts);
	return next;
}

function rebuildStreamPartsFromMessages(messages: MappedThreadMessage[]): {
	streamParts: StreamPartsState;
	streamFirstSeq: Map<string, number>;
} {
	const streamParts: StreamPartsState = new Map();
	const streamFirstSeq = new Map<string, number>();

	for (const message of messages) {
		if (message.role === "assistant" && Array.isArray(message.content)) {
			streamParts.set(message.id, [...message.content]);
			streamFirstSeq.set(message.id, message.seq);
		}
	}

	return { streamParts, streamFirstSeq };
}

function findLastStreamAssistantIndex(messages: MappedThreadMessage[]): number {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "assistant" && Array.isArray(message.content)) {
			return index;
		}
	}
	return -1;
}

function upsertStreamMessages(
	messages: MappedThreadMessage[],
	streamParts: StreamPartsState,
	streamFirstSeq: Map<string, number>,
	activeMessageId: string | null,
): MappedThreadMessage[] {
	let next = [...messages];

	for (const [messageId, parts] of streamParts) {
		const seq = streamFirstSeq.get(messageId) ?? 0;
		const idx = next.findIndex((message) => message.id === messageId);
		const streamMessage: MappedThreadMessage = {
			id: messageId,
			role: "assistant",
			content: parts,
			seq,
			status:
				activeMessageId === messageId
					? ("running" as const)
					: ("complete" as const),
		};

		if (idx >= 0) {
			next[idx] = { ...streamMessage, seq: next[idx]?.seq ?? streamMessage.seq };
		} else {
			next = [...next, streamMessage];
		}
	}

	return next.sort((a, b) => a.seq - b.seq);
}

function applyAssistantMessageStatus(
	messages: MappedThreadMessage[],
	isJobTerminal?: boolean,
): MappedThreadMessage[] {
	const lastStreamAssistantIdx = findLastStreamAssistantIndex(messages);
	if (lastStreamAssistantIdx < 0) return messages;

	return messages.map((message, index) => {
		if (message.role !== "assistant" || typeof message.content === "string") {
			return message;
		}

		if (isJobTerminal && index === lastStreamAssistantIdx) {
			return { ...message, status: "complete" as const };
		}
		if (!isJobTerminal && index === lastStreamAssistantIdx) {
			return { ...message, status: "running" as const };
		}
		if (index < lastStreamAssistantIdx) {
			return { ...message, status: "complete" as const };
		}
		return message;
	});
}

function applyDataPartToProgress(
	progress: IngestProgressState,
	part: IngestClientDataPart,
): IngestProgressState {
	switch (part.type) {
		case INGEST_DATA_PART.PHASE:
			return { ...progress, phase: part.data.phase };
		case INGEST_DATA_PART.STREAM_PROGRESS:
			return { ...progress, questionsSeen: part.data.questionsSeen };
		case INGEST_DATA_PART.SUMMARY:
			return {
				...progress,
				extracted: part.data.extracted,
				persisted: part.data.persisted,
				skippedDuplicate: part.data.skippedDuplicate,
				invalid: part.data.invalid,
			};
		case INGEST_DATA_PART.PERSIST_PROGRESS:
			return progress;
		default:
			return progress;
	}
}

function extractQuestionPreviewFromStreamParts(
	streamParts: StreamPartsState,
	event: Extract<IngestStreamPartEvent, { type: "tool-result" }>,
): IngestProgressState["extractedQuestionsPreview"][number] | null {
	const messageParts = streamParts.get(event.messageId);
	if (!messageParts) return null;

	const toolCallPart = messageParts.find(
		(part) =>
			part.type === "tool-call" &&
			part.toolCallId === event.toolCallId &&
			part.toolName === "submit_question",
	);
	if (toolCallPart?.type !== "tool-call") return null;

	const result = event.result;
	if (!result || typeof result !== "object") return null;
	const ok = "ok" in result ? result.ok : undefined;
	const index = "index" in result ? result.index : undefined;
	if (ok !== true || typeof index !== "number") return null;
	const args =
		toolCallPart.args && typeof toolCallPart.args === "object"
			? toolCallPart.args
			: null;
	if (!args) return null;

	const question = "question" in args ? args.question : undefined;
	const topic = "topic" in args ? args.topic : undefined;
	if (typeof question !== "string" || typeof topic !== "string") return null;

	return {
		index,
		question,
		topic,
	};
}

function applyStreamPartToProgress(
	progress: IngestProgressState,
	streamParts: StreamPartsState,
	event: IngestStreamPartEvent,
): IngestProgressState {
	if (event.type !== "tool-result") return progress;

	const preview = extractQuestionPreviewFromStreamParts(streamParts, event);
	if (!preview) return progress;

	const existingIndex = progress.extractedQuestionsPreview.findIndex(
		(item) => item.index === preview.index,
	);
	if (existingIndex >= 0) {
		const nextPreview = [...progress.extractedQuestionsPreview];
		nextPreview[existingIndex] = preview;
		return { ...progress, extractedQuestionsPreview: nextPreview };
	}

	return {
		...progress,
		extractedQuestionsPreview: [
			...progress.extractedQuestionsPreview,
			preview,
		].sort((a, b) => a.index - b.index),
	};
}

export function mergeJobEvents(
	current: {
		messages: MappedThreadMessage[];
		progress: IngestProgressState;
		lastSeq: number;
		events: JobEventRecord[];
		streamParts?: StreamPartsState;
		streamFirstSeq?: Map<string, number>;
		isJobTerminal?: boolean;
	},
	incoming: JobEventRecord[],
): {
	messages: MappedThreadMessage[];
	progress: IngestProgressState;
	lastSeq: number;
	events: JobEventRecord[];
	streamParts: StreamPartsState;
	streamFirstSeq: Map<string, number>;
} {
	let { messages, progress, lastSeq, events, isJobTerminal } = current;
	let streamParts = current.streamParts;
	let streamFirstSeq = current.streamFirstSeq;
	if (!streamParts) {
		({ streamParts, streamFirstSeq } =
			rebuildStreamPartsFromMessages(messages));
	}
	streamFirstSeq ??= new Map<string, number>();
	let activeStreamMessageId: string | null = null;

	for (const event of incoming) {
		if (event.seq <= lastSeq) continue;

		events = [...events, event];

		if (isIngestStreamPartEvent(event.payload)) {
			const { messageId } = event.payload;
			if (!streamFirstSeq.has(messageId)) {
				streamFirstSeq = new Map(streamFirstSeq);
				streamFirstSeq.set(messageId, event.seq);
			}
			streamParts = mergeStreamParts(streamParts, event.payload);
			activeStreamMessageId = messageId;
			messages = upsertStreamMessages(
				messages,
				streamParts,
				streamFirstSeq,
				activeStreamMessageId,
			);
			progress = applyStreamPartToProgress(
				progress,
				streamParts,
				event.payload,
			);
		} else {
			const text = messageForPayload(event.payload);
			const role = roleForPayload(event.payload);
			if (text && role) {
				const lastMessage = messages.at(-1);
				const isDuplicate =
					typeof lastMessage?.content === "string" &&
					lastMessage.content === text;
				if (!isDuplicate) {
					messages = [
						...messages,
						{
							id: `job-event-${event.seq}`,
							role,
							content: text,
							seq: event.seq,
						},
					];
				}
			}
		}

		if (isIngestDataPart(event.payload)) {
			progress = applyDataPartToProgress(progress, event.payload);
		}

		lastSeq = event.seq;
	}

	messages = applyAssistantMessageStatus(messages, isJobTerminal);

	return {
		messages,
		progress,
		lastSeq,
		events,
		streamParts,
		streamFirstSeq,
	};
}

export function formatPhaseLabel(phase: IngestPhase | null): string | null {
	if (!phase) return null;
	return PHASE_LABELS[phase] ?? phase;
}
