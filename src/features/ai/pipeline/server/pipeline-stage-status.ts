import type { StopCondition, ToolSet } from "ai";
import type { AiStreamState } from "@/features/ai/core/ai-stream-handler";
import { ingestStageStatusReported } from "@/features/ai/core/tool-agent-stop-when";
import {
	createReportAgentStageStatusTool,
	type IngestAgentReportedStatus,
	type IngestAgentResolvedStatus,
	type IngestAgentStageStatusReport,
	PIPELINE_STAGE_STATUS_COMPLETION_PROMPT,
	readIngestAgentStageStatusReport,
	resolvePipelineAgentRunStatus,
} from "@/features/ai/tools/ingest-stage-status";

export type PipelineStageStatusOptions = {
	enabled?: boolean;
	required?: boolean;
	appendPrompt?: boolean;
	hasSuccessfulWork?: (ctx: {
		streamState: AiStreamState;
		toolFailureMessages: string[];
	}) => boolean;
	fallbackMessage?: string;
};

export type ResolvedPipelineStageStatusConfig = {
	enabled: boolean;
	required: boolean;
	appendPrompt: boolean;
	hasSuccessfulWork?: PipelineStageStatusOptions["hasSuccessfulWork"];
	fallbackMessage?: string;
};

export function resolvePipelineStageStatusConfig(
	options?: PipelineStageStatusOptions,
): ResolvedPipelineStageStatusConfig {
	return {
		enabled: options?.enabled ?? true,
		required: options?.required ?? true,
		appendPrompt: options?.appendPrompt ?? true,
		hasSuccessfulWork: options?.hasSuccessfulWork,
		fallbackMessage: options?.fallbackMessage,
	};
}

export function appendPipelineStageStatusPrompt(
	systemPrompt: string,
	appendPrompt: boolean,
): string {
	if (!appendPrompt) return systemPrompt;
	return `${systemPrompt}\n\n${PIPELINE_STAGE_STATUS_COMPLETION_PROMPT}`;
}

export function mergePipelineStageStatusTools(
	tools: ToolSet,
	enabled: boolean,
): ToolSet {
	if (!enabled) return tools;
	return { ...createReportAgentStageStatusTool(), ...tools };
}

export function mergePipelineStageStatusStopWhen<T extends ToolSet>(
	stopWhen: StopCondition<T> | Array<StopCondition<T>> | undefined,
	enabled: boolean,
): StopCondition<T> | Array<StopCondition<T>> {
	if (!enabled) {
		return stopWhen ?? [];
	}

	const conditions = Array.isArray(stopWhen)
		? [...stopWhen]
		: stopWhen != null
			? [stopWhen]
			: [];

	conditions.push(ingestStageStatusReported as unknown as StopCondition<T>);
	return conditions;
}

export function createPipelineStageStatusTracker() {
	let stageStatusReport: IngestAgentStageStatusReport | null = null;
	let reportedStageStatus: IngestAgentReportedStatus | null = null;

	return {
		get stageStatusReport() {
			return stageStatusReport;
		},
		get reportedStageStatus() {
			return reportedStageStatus;
		},
		trackToolResult(toolName: string, content: unknown) {
			if (toolName !== "report_agent_stage_status") return;
			const report = readIngestAgentStageStatusReport(content);
			stageStatusReport = report;
			reportedStageStatus = report?.status ?? null;
		},
	};
}

export function resolvePipelineStageStatusOutcome(params: {
	config: ResolvedPipelineStageStatusConfig;
	stageStatusReport: IngestAgentStageStatusReport | null;
	toolFailureMessages: string[];
	streamState: AiStreamState;
}): {
	resolvedStageStatus: { status: IngestAgentResolvedStatus; message: string };
	strictFailureReason: string | null;
} {
	const { config, stageStatusReport, toolFailureMessages, streamState } = params;

	if (config.enabled && config.required && stageStatusReport == null) {
		return {
			resolvedStageStatus: {
				status: "error",
				message: "Agent finished without calling report_agent_stage_status.",
			},
			strictFailureReason:
				"Agent finished without calling report_agent_stage_status.",
		};
	}

	const resolvedStageStatus = resolvePipelineAgentRunStatus({
		reported: stageStatusReport,
		toolFailureMessages,
		hasSuccessfulWork:
			config.hasSuccessfulWork?.({ streamState, toolFailureMessages }) ?? true,
		fallbackMessage: config.fallbackMessage,
	});

	return { resolvedStageStatus, strictFailureReason: null };
}

export type {
	IngestAgentReportedStatus as PipelineAgentReportedStatus,
	IngestAgentResolvedStatus as PipelineAgentResolvedStatus,
	IngestAgentStageStatusReport as PipelineStageStatusReport,
};
