import type {
	IngestAgentRunViewModel,
	IngestLogEntry,
	IngestOutputEntry,
	IngestPipelineStageViewModel,
	IngestTokenTotals,
} from "@/components/ingest/types";
import type { TokenTotals } from "@/stores/ingestStore";

export function normalizeTokenTotals(value: TokenTotals): IngestTokenTotals {
	return {
		prompt: value.prompt ?? 0,
		completion: value.completion ?? 0,
		total: value.total ?? 0,
	};
}
export function normalizePartialTokenTotals(
	value: unknown,
): Partial<IngestTokenTotals> | undefined {
	if (!isRecord(value)) return undefined;
	return {
		prompt: readNumber(value.prompt) ?? 0,
		completion: readNumber(value.completion) ?? 0,
		total:
			readNumber(value.total) ??
			(readNumber(value.prompt) ?? 0) + (readNumber(value.completion) ?? 0),
	};
}

export function normalizeStageStatus(
	value: unknown,
): IngestPipelineStageViewModel["status"] | null {
	switch (value) {
		case "pending":
		case "running":
		case "done":
		case "warning":
		case "error":
		case "skipped":
			return value;
		default:
			return null;
	}
}

export function normalizeRole(
	value: unknown,
): "system" | "user" | "assistant" | null {
	switch (value) {
		case "system":
		case "user":
		case "assistant":
			return value;
		default:
			return "assistant";
	}
}

export function normalizeOutputStatus(
	value: unknown,
): Extract<IngestOutputEntry, { kind: "message" }>["status"] {
	switch (value) {
		case "warning":
		case "error":
		case "success":
		case "default":
			return value;
		default:
			return undefined;
	}
}

export function normalizeEventTone(
	value: unknown,
): Extract<IngestOutputEntry, { kind: "event" }>["tone"] {
	switch (value) {
		case "warning":
		case "error":
		case "success":
		case "neutral":
			return value;
		default:
			return undefined;
	}
}
export function normalizeLogLevel(value: unknown): IngestLogEntry["level"] {
	switch (value) {
		case "debug":
		case "warning":
		case "error":
			return value;
		default:
			return "info";
	}
}
export function normalizeAgentState(
	value: unknown,
): IngestAgentRunViewModel["state"] {
	switch (value) {
		case "pending":
		case "running":
		case "success":
		case "warning":
		case "error":
			return value;
		case "skipped":
			return "warning";
		case "done":
		case "complete":
		case "completed":
			return "success";
		default:
			return "pending";
	}
}

export function inferLogLevel(line: string): IngestLogEntry["level"] {
	const lower = line.toLowerCase();
	if (lower.includes("error")) return "error";
	if (lower.includes("warning")) return "warning";
	return "info";
}

export function readArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

export function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readNullableString(value: unknown): string | null | undefined {
	return typeof value === "string" ? value : value == null ? null : undefined;
}

export function readNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function readResponseFallback(value: unknown): string | undefined {
	if (typeof value === "string" && value.length > 0) return value;
	if (typeof value === "object" && value !== null) {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return undefined;
		}
	}
	return undefined;
}
