import type {
	IngestLogEntry,
	IngestOutputEntry,
	IngestPipelineStageViewModel,
} from "@/features/ingest/components/types";
import type { FlowStage } from "@/features/ingest/store";
import {
	isRecord,
	normalizeEventTone,
	normalizeLogLevel,
	normalizeOutputStatus,
	normalizeRole,
	normalizeStageStatus,
	readNullableString,
	readNumber,
	readString,
} from "./job-view-model-utils";

export function toLegacyStage(
	stage: FlowStage,
): IngestPipelineStageViewModel | null {
	if (!stage.stageId || !stage.label) return null;
	return {
		stageId: stage.stageId,
		label: stage.label,
		status: normalizeStageStatus(stage.status) ?? "pending",
		timestamp: stage.timestamp,
		meta: stage.meta,
	};
}

export function toStageViewModel(
	value: unknown,
): IngestPipelineStageViewModel | null {
	if (!isRecord(value)) return null;
	const stageId = readString(value.stageId) ?? readString(value.id);
	const label = readString(value.label) ?? readString(value.name);
	const status = normalizeStageStatus(value.status);
	const timestamp = readNumber(value.timestamp) ?? Date.now();
	if (!stageId || !label || !status) return null;
	return {
		stageId,
		label,
		status,
		timestamp,
		meta: isRecord(value.meta) ? value.meta : undefined,
	};
}

export function toOutputEntry(value: unknown): IngestOutputEntry | null {
	if (!isRecord(value)) return null;
	const id = readString(value.id) ?? crypto.randomUUID();
	const kind = readString(value.kind);
	if (kind === "event") {
		const label = readString(value.label) ?? readString(value.title) ?? "Event";
		return {
			id,
			kind: "event",
			stageId: readNullableString(value.stageId),
			label,
			content: readString(value.content),
			tone: normalizeEventTone(value.tone),
			data: value.data,
		};
	}
	const role = normalizeRole(value.role);
	const content =
		readString(value.content) ??
		readString(value.text) ??
		readString(value.message);
	if (!role || !content) return null;
	return {
		id,
		kind: "message",
		stageId: readNullableString(value.stageId),
		role,
		content,
		label: readString(value.label),
		status: normalizeOutputStatus(value.status),
	};
}

export function toStoreOutputEntry(
	value: unknown,
	index: number,
): IngestOutputEntry | null {
	if (!isRecord(value)) return null;
	const kind = readString(value.kind);
	const text = readString(value.text);
	if (!text) return null;
	const id = readString(value.id) ?? `output-${index}`;
	const stageId = readNullableString(value.stageId);
	if (kind === "warning") {
		return {
			id,
			kind: "message",
			stageId,
			role: "system",
			content: text,
			label: "Warning",
			status: "warning",
		};
	}
	if (kind === "chunk") {
		return {
			id,
			kind: "message",
			stageId,
			role: "assistant",
			content: text,
			label: readString(value.agentRunId) ?? "Agent output",
		};
	}
	return null;
}

export function toLogEntry(
	value: unknown,
	index: number,
): IngestLogEntry | null {
	if (typeof value === "string") {
		const lower = value.toLowerCase();
		return {
			id: `legacy-log-${index}`,
			level: lower.includes("error")
				? "error"
				: lower.includes("warning")
					? "warning"
					: "info",
			message: value,
		};
	}
	if (!isRecord(value)) return null;
	const id = readString(value.id) ?? `log-${index}`;
	const message =
		readString(value.message) ??
		readString(value.text) ??
		readString(value.label);
	if (!message) return null;
	return {
		id,
		stageId: readNullableString(value.stageId),
		timestamp: readNumber(value.timestamp),
		level: normalizeLogLevel(value.level),
		message,
		agentId: readString(value.agentId) ?? readString(value.agentRunId),
		data: value.data,
	};
}
