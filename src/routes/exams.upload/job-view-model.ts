import type {
	IngestAgentRunViewModel,
	IngestJobViewModel,
	IngestLogEntry,
	IngestPipelineStageViewModel,
} from "@/components/ingest/types";
import type { IngestJob } from "@/stores/ingestStore";
import { toAgentRun } from "./agent-converter";
import {
	toLegacyStage,
	toLogEntry,
	toStageViewModel,
} from "./job-view-model-converters";
import {
	normalizeTokenTotals,
	readArray,
	readString,
} from "./job-view-model-utils";
import {
	coalesceOutputEntries,
	readStructuredOutputEntries,
} from "./output-processors";

export function toIngestJobViewModel(job: IngestJob): IngestJobViewModel {
	const dynamicJob = job as IngestJob & Record<string, unknown>;
	const stages = readStructuredStages(dynamicJob);
	const outputEntries = coalesceOutputEntries(
		readStructuredOutputEntries(dynamicJob, job, stages),
	);
	const logs = readStructuredLogs(dynamicJob);
	const agents = readStructuredAgents(dynamicJob);

	return {
		id: job.id,
		fileName: job.fileName,
		status: job.status,
		enableReview: job.enableReview,
		tokenTotals: normalizeTokenTotals(job.tokenTotals),
		outputEntries,
		rawOutput:
			readString(dynamicJob.rawOutput) ??
			readString(dynamicJob.streamText) ??
			outputEntries
				.map((entry) =>
					entry.kind === "message"
						? `${entry.role.toUpperCase()}: ${entry.content}`
						: `${entry.label}${entry.content ? `: ${entry.content}` : ""}`,
				)
				.join("\n\n"),
		rawStreamText: job.rawStreamText ?? "",
		logs,
		stages,
		agents,
		error: job.error,
	};
}

function readStructuredStages(
	job: IngestJob & Record<string, unknown>,
): IngestPipelineStageViewModel[] {
	const structuredStages = readArray(job.stages);
	if (structuredStages.length > 0) {
		return structuredStages
			.map((stage) => toStageViewModel(stage))
			.filter((stage): stage is IngestPipelineStageViewModel => stage != null);
	}

	return job.flowStages
		.map((stage) => toLegacyStage(stage))
		.filter((stage): stage is IngestPipelineStageViewModel => stage != null);
}

function readStructuredLogs(
	job: IngestJob & Record<string, unknown>,
): IngestLogEntry[] {
	const structuredLogs = readArray(job.logs)
		.map((entry, index) => toLogEntry(entry, index))
		.filter((entry): entry is IngestLogEntry => entry != null);
	if (structuredLogs.length > 0) return structuredLogs;

	for (const candidate of [job.structuredLogs, job.logEvents]) {
		const entries = readArray(candidate)
			.map((entry, index) => toLogEntry(entry, index))
			.filter((entry): entry is IngestLogEntry => entry != null);
		if (entries.length > 0) return entries;
	}

	return [];
}

function readStructuredAgents(
	job: IngestJob & Record<string, unknown>,
): IngestAgentRunViewModel[] {
	const structuredAgents = readArray(job.agentRuns)
		.map((entry) => toAgentRun(entry))
		.filter((entry): entry is IngestAgentRunViewModel => entry != null);
	if (structuredAgents.length > 0) return structuredAgents;

	for (const candidate of [job.reviewAgents, job.reviewerAgents]) {
		const entries = readArray(candidate)
			.map((entry) => toAgentRun(entry))
			.filter((entry): entry is IngestAgentRunViewModel => entry != null);
		if (entries.length > 0) return entries;
	}

	return [];
}
