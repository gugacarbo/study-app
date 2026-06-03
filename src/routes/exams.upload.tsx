import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import { JobDetailPanel } from "@/components/ingest/JobDetailPanel";
import { QueueList } from "@/components/ingest/QueueList";
import type {
	IngestAgentRunViewModel,
	IngestJobViewModel,
	IngestLogEntry,
	IngestOutputEntry,
	IngestPipelineStageViewModel,
	IngestTokenTotals,
} from "@/components/ingest/types";
import { UploadCard } from "@/components/ingest/UploadCard";
import { Card, CardContent } from "@/components/ui/card";
import type { FlowStage, IngestJob, TokenTotals } from "@/stores/ingestStore";
import {
	cancelJob,
	clearSavedIngestJobs,
	enqueueIngest,
	focusJob,
	ingestStore,
} from "@/stores/ingestStore";

export const Route = createFileRoute("/exams/upload")({
	component: IngestPage,
});

function IngestPage() {
	const { jobs, focusedJobId } = useStore(ingestStore, (state) => ({
		jobs: state.jobs,
		focusedJobId: state.focusedJobId,
	}));

	const [activeTab, setActiveTab] = useState<"output" | "process">("output");
	const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

	const focusedJob = useMemo(() => {
		if (focusedJobId == null) return null;
		const job = jobs.find((candidate) => candidate.id === focusedJobId) ?? null;
		return job ? toIngestJobViewModel(job) : null;
	}, [focusedJobId, jobs]);

	async function handleUpload(file: File, enableReview: boolean) {
		const buffer = await file.arrayBuffer();
		enqueueIngest(file.name, Array.from(new Uint8Array(buffer)), enableReview);
	}

	function handleStageClick(stageId: string) {
		setSelectedStageId((current) => (current === stageId ? null : stageId));
	}

	function handleClearStageFilter() {
		setSelectedStageId(null);
	}

	return (
		<div data-fullwidth className="flex min-h-0 w-full flex-1 flex-col">
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 md:p-6 xl:flex-row">
				<div className="flex shrink-0 flex-col gap-3 overflow-hidden xl:w-55">
					<UploadCard onUpload={handleUpload} />
					<QueueList
						jobs={jobs}
						focusedJobId={focusedJobId}
						onFocusJob={focusJob}
						onCancelJob={cancelJob}
						onClearSaved={clearSavedIngestJobs}
					/>
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{!focusedJob ? (
						<Card className="flex h-full min-h-0 flex-1 flex-col border-white/15 bg-[#0b1730] text-slate-100">
							<CardContent className="flex flex-1 items-center justify-center text-xs text-slate-400">
								Select a job from the queue
							</CardContent>
						</Card>
					) : (
						<JobDetailPanel
							job={focusedJob}
							activeTab={activeTab}
							selectedStageId={selectedStageId}
							onTabChange={setActiveTab}
							onStageClick={handleStageClick}
							onClearStageFilter={handleClearStageFilter}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

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

function readStructuredOutputEntries(
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
	if (structuredEntries.length > 0) {
		return structuredEntries;
	}

	const candidates = [job.outputs, job.structuredOutputs, job.stageOutputs];
	for (const candidate of candidates) {
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

function coalesceOutputEntries(
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

function readStructuredLogs(
	job: IngestJob & Record<string, unknown>,
): IngestLogEntry[] {
	const structuredLogs = readArray(job.logs)
		.map((entry, index) => toLogEntry(entry, index))
		.filter((entry): entry is IngestLogEntry => entry != null);
	if (structuredLogs.length > 0) {
		return structuredLogs;
	}

	const candidates = [job.structuredLogs, job.logEvents];

	for (const candidate of candidates) {
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
	if (structuredAgents.length > 0) {
		return structuredAgents;
	}

	const candidates = [job.reviewAgents, job.reviewerAgents];

	for (const candidate of candidates) {
		const entries = readArray(candidate)
			.map((entry) => toAgentRun(entry))
			.filter((entry): entry is IngestAgentRunViewModel => entry != null);
		if (entries.length > 0) return entries;
	}

	return [];
}

function toLegacyStage(stage: FlowStage): IngestPipelineStageViewModel | null {
	if (!stage.stageId || !stage.label) return null;
	return {
		stageId: stage.stageId,
		label: stage.label,
		status: normalizeStageStatus(stage.status) ?? "pending",
		timestamp: stage.timestamp,
		meta: stage.meta,
	};
}

function toStageViewModel(value: unknown): IngestPipelineStageViewModel | null {
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

function toOutputEntry(value: unknown): IngestOutputEntry | null {
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

function toStoreOutputEntry(
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

function toLogEntry(value: unknown, index: number): IngestLogEntry | null {
	if (typeof value === "string") {
		return {
			id: `legacy-log-${index}`,
			level: inferLogLevel(value),
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

function toAgentRun(value: unknown): IngestAgentRunViewModel | null {
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

function normalizeTokenTotals(value: TokenTotals): IngestTokenTotals {
	return {
		prompt: value.prompt ?? 0,
		completion: value.completion ?? 0,
		total: value.total ?? 0,
	};
}

function normalizePartialTokenTotals(
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

function normalizeStageStatus(
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

function normalizeRole(value: unknown): "system" | "user" | "assistant" | null {
	switch (value) {
		case "system":
		case "user":
		case "assistant":
			return value;
		default:
			return "assistant";
	}
}

function normalizeOutputStatus(
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

function normalizeEventTone(
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

function normalizeLogLevel(value: unknown): IngestLogEntry["level"] {
	switch (value) {
		case "debug":
		case "warning":
		case "error":
			return value;
		default:
			return "info";
	}
}

function normalizeAgentState(value: unknown): IngestAgentRunViewModel["state"] {
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

function inferLogLevel(line: string): IngestLogEntry["level"] {
	const lower = line.toLowerCase();
	if (lower.includes("error")) return "error";
	if (lower.includes("warning")) return "warning";
	return "info";
}

function readArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNullableString(value: unknown): string | null | undefined {
	return typeof value === "string" ? value : value == null ? null : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readResponseFallback(value: unknown): string | undefined {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	if (typeof value === "object" && value !== null) {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return undefined;
		}
	}
	return undefined;
}
