import type {
	IngestOutputEntry,
	IngestPipelineStageViewModel,
} from "@/components/ingest/types";
import type { IngestJob } from "@/stores/ingestStore";
import { toOutputEntry, toStoreOutputEntry } from "./job-view-model-converters";
import { readArray, readString } from "./job-view-model-utils";

export function readStructuredOutputEntries(
	job: IngestJob & Record<string, unknown>,
	legacyJob: IngestJob,
	stages: IngestPipelineStageViewModel[],
): IngestOutputEntry[] {
	const structuredEntries = readArray(job.outputEntries)
		.map(
			(entry, index) =>
				toStoreOutputEntry(entry, index) ?? toOutputEntry(entry),
		)
		.filter((entry): entry is IngestOutputEntry => entry != null);
	if (structuredEntries.length > 0) return structuredEntries;

	for (const candidate of [
		job.outputs,
		job.structuredOutputs,
		job.stageOutputs,
	]) {
		const entries = readArray(candidate)
			.map((entry) => toOutputEntry(entry))
			.filter((entry): entry is IngestOutputEntry => entry != null);
		if (entries.length > 0) return entries;
	}

	const fallbackEntries: IngestOutputEntry[] = [];
	const streamText = readString(job.streamText) ?? "";
	if (streamText.trim()) {
		fallbackEntries.push({
			id: `${legacyJob.id}-stream-output`,
			kind: "message",
			stageId: stages.at(-1)?.stageId ?? null,
			role: "assistant",
			content: streamText,
			label: "Assistant output",
		});
	}
	for (const [index, warning] of legacyJob.warnings.entries()) {
		fallbackEntries.push({
			id: `${legacyJob.id}-warning-${index}`,
			kind: "message",
			stageId: stages.at(-1)?.stageId ?? null,
			role: "system",
			content: warning,
			label: "Warning",
			status: "warning",
		});
	}
	return fallbackEntries;
}

export function coalesceOutputEntries(
	entries: IngestOutputEntry[],
): IngestOutputEntry[] {
	const merged: IngestOutputEntry[] = [];
	for (const entry of entries) {
		const previous = merged[merged.length - 1];
		if (
			previous?.kind === "message" &&
			entry.kind === "message" &&
			previous.role === entry.role &&
			previous.stageId === entry.stageId &&
			previous.label === entry.label &&
			previous.status === entry.status
		) {
			merged[merged.length - 1] = {
				...previous,
				content: `${previous.content}${entry.content}`,
			};
			continue;
		}
		merged.push(entry);
	}
	return merged;
}
