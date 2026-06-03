import type { IngestAgentRunViewModel } from "@/components/ingest/types";
import {
	isRecord,
	normalizeAgentState,
	normalizePartialTokenTotals,
	readNumber,
	readResponseFallback,
	readString,
} from "./job-view-model-utils";

export function toAgentRun(value: unknown): IngestAgentRunViewModel | null {
	if (!isRecord(value)) return null;
	const id =
		readString(value.id) ?? readString(value.agentId) ?? crypto.randomUUID();
	const stageId = readString(value.stageId);
	const name =
		readString(value.name) ??
		readString(value.agentName) ??
		readString(value.label);
	if (!stageId || !name) return null;

	return {
		id,
		stageId,
		name,
		state: normalizeAgentState(value.state ?? value.status),
		summary:
			readString(value.summary) ??
			readString(value.statusText) ??
			readString(value.description) ??
			readString(value.error),
		startedAt: readNumber(value.startedAt) ?? readNumber(value.timestamp),
		updatedAt: readNumber(value.updatedAt) ?? readNumber(value.timestamp),
		finishedAt: readNumber(value.finishedAt),
		systemPrompt:
			readString(value.systemPrompt) ??
			readString(value.system) ??
			readString(value.prompt),
		userPrompt: readString(value.userPrompt) ?? readString(value.user),
		response:
			readString(value.response) ??
			readString(value.output) ??
			readString(value.outputText) ??
			readResponseFallback(value.rawOutput),
		tokens: normalizePartialTokenTotals(value.tokens ?? value.tokenTotals),
		error: readString(value.error),
		raw: {
			payload: value.payload ?? value.rawOutput,
			stream: value.stream ?? value.outputText,
			status: value.status,
			tokens: value.tokens ?? value.tokenTotals,
			error: value.error,
			meta: isRecord(value.meta) ? value.meta : undefined,
		},
	};
}
