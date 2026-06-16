import type {
	IngestAgentRunViewModel,
	IngestJobViewModel,
	IngestPipelineStageViewModel,
} from "@/features/ingest/components/types";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import type { IngestJob } from "@/features/ingest/store";
import { toAgentRun } from "./-agent-converter";
import { toLogEntry } from "./-job-view-model-converters";
import {
	normalizeStageStatus,
	normalizeTokenTotals,
	readArray,
	readString,
} from "./-job-view-model-utils";
import {
	coalesceOutputEntries,
	readStructuredOutputEntries,
} from "./-output-processors";

export function toIngestJobViewModel(job: IngestJob): IngestJobViewModel {
	const dynamicJob = job as IngestJob & Record<string, unknown>;
	const stages = readStructuredStages(job);
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
		enableExplanations: job.enableExplanations,
		agentConcurrency: job.agentConcurrency,
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
	job: IngestJob,
): IngestPipelineStageViewModel[] {
	return job.stages
		.map((stage) => ({
			stageId: stage.stageId,
			label: stage.label,
			status: normalizeStageStatus(stage.status) ?? "pending",
			timestamp: stage.timestamp,
			meta: stage.meta,
		}))
		.filter((stage) => stage.stageId.length > 0 && stage.label.length > 0);
}

function readStructuredLogs(
	job: IngestJob & Record<string, unknown>,
): PipelineLogEntry[] {
	const structuredLogs = readArray(job.logs)
		.map((entry, index) => toLogEntry(entry, index))
		.filter((entry): entry is PipelineLogEntry => entry != null);
	if (structuredLogs.length > 0) return structuredLogs;

	for (const candidate of [job.structuredLogs, job.logEvents]) {
		const entries = readArray(candidate)
			.map((entry, index) => toLogEntry(entry, index))
			.filter((entry): entry is PipelineLogEntry => entry != null);
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
