import {
	INGEST_DATA_PART,
	type IngestDataPart,
	type IngestPersistProgressPart,
	type IngestPhasePart,
	type IngestSkippedDuplicatePart,
	type IngestStreamProgressPart,
	type IngestSummaryPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import { PHASE_TEXT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import { INGEST_PHASE, type IngestPhase } from "@/lib/job-kinds";

export type IngestClientDataPart = IngestDataPart;

export type IngestStreamPartEvent =
	| { type: "reasoning-delta"; messageId: string; delta: string }
	| { type: "reasoning"; messageId: string; text: string }
	| {
			type: "tool-call";
			messageId: string;
			toolCallId: string;
			toolName: string;
			argsText: string;
			state: "running";
	  }
	| {
			type: "tool-result";
			messageId: string;
			toolCallId: string;
			result: unknown;
			isError?: boolean;
	  }
	| { type: "text"; messageId: string; text: string };

export type IngestEventType =
	| "Fase"
	| "Progresso"
	| "Persistência"
	| "Texto"
	| "Raciocínio"
	| "Tool"
	| "Resumo"
	| "Duplicata"
	| "Outro";

const PHASE_LABELS: Record<IngestPhase, string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo arquivo",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões",
	[INGEST_PHASE.PERSISTING]: "Salvando questões",
};

const PHASE_TEXT_VALUES = new Set<string>(Object.values(PHASE_TEXT));

/** Frozen system text events (SPEC-0019 §Fase 2) — static literals only. */
export const INGEST_SYSTEM_TEXT = {
	LLM_CALL: "Chamando modelo para extração…",
} as const;

const INGEST_SYSTEM_TEXT_STATIC = new Set<string>([
	...PHASE_TEXT_VALUES,
	INGEST_SYSTEM_TEXT.LLM_CALL,
]);

const FILE_READ_TEXT = /^Arquivo lido: [\d.]+ caracteres$/;
const LLM_RETRY_TEXT = /^Tentativa \d+\/\d+…$/;
const PERSIST_VALIDATING_TEXT = /^Validando \d+ questão\(ões\)…$/;

export function isPhaseStatusText(text: string): boolean {
	if (INGEST_SYSTEM_TEXT_STATIC.has(text)) return true;
	if (FILE_READ_TEXT.test(text)) return true;
	if (LLM_RETRY_TEXT.test(text)) return true;
	if (PERSIST_VALIDATING_TEXT.test(text)) return true;
	return false;
}

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

function hasMessageId(payload: unknown): payload is { messageId: string } {
	return (
		!!payload &&
		typeof payload === "object" &&
		"messageId" in payload &&
		typeof (payload as { messageId: unknown }).messageId === "string"
	);
}

function isSystemTextPart(
	payload: unknown,
): payload is { type: "text"; text: string } {
	return (
		!!payload &&
		typeof payload === "object" &&
		"type" in payload &&
		(payload as { type: string }).type === "text" &&
		"text" in payload &&
		typeof (payload as { text: unknown }).text === "string" &&
		!hasMessageId(payload)
	);
}

export function isIngestStreamPartEvent(
	payload: unknown,
): payload is IngestStreamPartEvent {
	if (!payload || typeof payload !== "object" || !("type" in payload)) {
		return false;
	}
	if (!hasMessageId(payload)) return false;

	const type = (payload as { type: string }).type;
	switch (type) {
		case "reasoning-delta":
			return (
				"delta" in payload &&
				typeof (payload as { delta: unknown }).delta === "string"
			);
		case "reasoning":
			return (
				"text" in payload &&
				typeof (payload as { text: unknown }).text === "string"
			);
		case "tool-call":
			return (
				"toolCallId" in payload &&
				typeof (payload as { toolCallId: unknown }).toolCallId === "string" &&
				"toolName" in payload &&
				typeof (payload as { toolName: unknown }).toolName === "string" &&
				"argsText" in payload &&
				typeof (payload as { argsText: unknown }).argsText === "string" &&
				"state" in payload &&
				(payload as { state: unknown }).state === "running"
			);
		case "tool-result":
			return (
				"toolCallId" in payload &&
				typeof (payload as { toolCallId: unknown }).toolCallId === "string" &&
				"result" in payload
			);
		case "text":
			return (
				"text" in payload &&
				typeof (payload as { text: unknown }).text === "string"
			);
		default:
			return false;
	}
}

function messageForPhasePart(part: IngestPhasePart): string {
	return `${PHASE_LABELS[part.data.phase]}…`;
}

function messageForProgressPart(part: IngestStreamProgressPart): string {
	const count = part.data.questionsSeen;
	if (count === 1) return "Identifiquei 1 questão até agora…";
	return `Identifiquei ${count} questões até agora…`;
}

function messageForPersistProgressPart(part: IngestPersistProgressPart): string {
	const { saved, total } = part.data;
	return `Salvando ${saved}/${total} questão(ões)…`;
}

function messageForSkippedPart(part: IngestSkippedDuplicatePart): string {
	return `Duplicata ignorada: "${part.data.questionPreview}"`;
}

function messageForSummaryPart(part: IngestSummaryPart): string {
	const { persisted, skippedDuplicate, invalid } = part.data;
	const parts = [`${persisted} questão(ões) salva(s)`];
	if (skippedDuplicate > 0) {
		parts.push(`${skippedDuplicate} duplicata(s) ignorada(s)`);
	}
	if (invalid > 0) {
		parts.push(`${invalid} inválida(s)`);
	}
	return `Importação concluída: ${parts.join(", ")}.`;
}

function messageForStreamPart(part: IngestStreamPartEvent): string {
	switch (part.type) {
		case "reasoning-delta":
			return part.delta;
		case "reasoning":
			return part.text;
		case "tool-call":
			return `${part.toolName}(${part.argsText})`;
		case "tool-result":
			return JSON.stringify(part.result);
		case "text":
			return part.text;
	}
}

export function formatEventLabel(payload: unknown): string | null {
	if (isIngestStreamPartEvent(payload)) {
		return messageForStreamPart(payload);
	}
	if (isSystemTextPart(payload)) return payload.text;
	if (!isIngestDataPart(payload)) return null;

	switch (payload.type) {
		case INGEST_DATA_PART.PHASE:
			return messageForPhasePart(payload);
		case INGEST_DATA_PART.STREAM_PROGRESS:
			return messageForProgressPart(payload);
		case INGEST_DATA_PART.PERSIST_PROGRESS:
			return messageForPersistProgressPart(payload);
		case INGEST_DATA_PART.SKIPPED_DUPLICATE:
			return messageForSkippedPart(payload);
		case INGEST_DATA_PART.SUMMARY:
			return messageForSummaryPart(payload);
		default:
			return null;
	}
}

export function formatEventType(payload: unknown): IngestEventType {
	if (isIngestStreamPartEvent(payload)) {
		switch (payload.type) {
			case "reasoning-delta":
			case "reasoning":
				return "Raciocínio";
			case "tool-call":
			case "tool-result":
				return "Tool";
			case "text":
				return "Texto";
		}
	}
	if (isSystemTextPart(payload)) return "Texto";
	if (!isIngestDataPart(payload)) return "Outro";

	switch (payload.type) {
		case INGEST_DATA_PART.PHASE:
			return "Fase";
		case INGEST_DATA_PART.STREAM_PROGRESS:
			return "Progresso";
		case INGEST_DATA_PART.PERSIST_PROGRESS:
			return "Persistência";
		case INGEST_DATA_PART.SKIPPED_DUPLICATE:
			return "Duplicata";
		case INGEST_DATA_PART.SUMMARY:
			return "Resumo";
		default:
			return "Outro";
	}
}

export function formatEventDetails(
	payload: unknown,
): { label: string; value: string }[] {
	if (isIngestStreamPartEvent(payload)) {
		switch (payload.type) {
			case "reasoning-delta":
				return [
					{ label: "messageId", value: payload.messageId },
					{ label: "delta", value: payload.delta },
				];
			case "reasoning":
				return [
					{ label: "messageId", value: payload.messageId },
					{ label: "texto", value: payload.text },
				];
			case "tool-call":
				return [
					{ label: "messageId", value: payload.messageId },
					{ label: "tool", value: payload.toolName },
					{ label: "toolCallId", value: payload.toolCallId },
					{ label: "args", value: payload.argsText },
				];
			case "tool-result":
				return [
					{ label: "messageId", value: payload.messageId },
					{ label: "toolCallId", value: payload.toolCallId },
					{
						label: "resultado",
						value: JSON.stringify(payload.result),
					},
					...(payload.isError
						? [{ label: "erro", value: "true" }]
						: []),
				];
			case "text":
				return [
					{ label: "messageId", value: payload.messageId },
					{ label: "texto", value: payload.text },
				];
		}
	}
	if (isSystemTextPart(payload)) {
		return [{ label: "Mensagem", value: payload.text }];
	}
	if (!isIngestDataPart(payload)) return [];

	switch (payload.type) {
		case INGEST_DATA_PART.PHASE:
			return [
				{
					label: "Fase",
					value: PHASE_LABELS[payload.data.phase] ?? payload.data.phase,
				},
			];
		case INGEST_DATA_PART.STREAM_PROGRESS:
			return [
				{
					label: "Questões identificadas",
					value: String(payload.data.questionsSeen),
				},
			];
		case INGEST_DATA_PART.PERSIST_PROGRESS:
			return [
				{ label: "Salvas", value: String(payload.data.saved) },
				{ label: "Total", value: String(payload.data.total) },
			];
		case INGEST_DATA_PART.SKIPPED_DUPLICATE:
			return [
				{ label: "Prévia", value: payload.data.questionPreview },
			];
		case INGEST_DATA_PART.SUMMARY:
			return [
				{ label: "Extraídas", value: String(payload.data.extracted) },
				{ label: "Salvas", value: String(payload.data.persisted) },
				{
					label: "Duplicatas",
					value: String(payload.data.skippedDuplicate),
				},
				{ label: "Inválidas", value: String(payload.data.invalid) },
			];
		default:
			return [];
	}
}

export function messageForPayload(payload: unknown): string | null {
	if (isIngestStreamPartEvent(payload)) return null;
	if (isIngestDataPart(payload) && payload.type === INGEST_DATA_PART.PHASE) {
		return null;
	}
	if (
		isIngestDataPart(payload) &&
		(payload.type === INGEST_DATA_PART.STREAM_PROGRESS ||
			payload.type === INGEST_DATA_PART.PERSIST_PROGRESS)
	) {
		return null;
	}
	return formatEventLabel(payload);
}

export function roleForPayload(payload: unknown): "system" | "assistant" | null {
	if (isIngestStreamPartEvent(payload)) return null;
	const text = messageForPayload(payload);
	if (!text) return null;
	if (isSystemTextPart(payload) && isPhaseStatusText(payload.text)) {
		return "system";
	}
	return "assistant";
}

export { PHASE_LABELS };
