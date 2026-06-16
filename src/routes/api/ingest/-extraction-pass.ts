import type { ToolSet } from "ai";
import { parseExamNameFromFileName } from "@/features/ai/agents/ingest/parse-exam-name";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import { INGEST_EXTRACTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import { readToolFailureMessage } from "@/features/ai/core/tool-agent-run";
import {
	buildExtractionPrepareStep,
	buildIngestExtractionStopWhen,
} from "@/features/ai/core/tool-agent-stop-when";
import type { createAgentRunWriter } from "@/features/ai/core/ui-message-job-stream";
import { createAgentEventEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import type { PipelineLogger } from "@/features/ai/pipeline/server/pipeline-logger";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";
import type { IngestAgentResolvedStatus } from "@/features/ai/tools/ingest-stage-status";
import {
	type IngestAgentReportedStatus,
	type IngestAgentStageStatusReport,
	readIngestAgentStageStatusReport,
	resolveIngestAgentRunStatus,
} from "@/features/ai/tools/ingest-stage-status";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import type { AgentRunStatus } from "@/features/ai/types/ui-message-data-parts";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import {
	buildExtractionUserPrompt,
	estimateSourceQuestionCount,
} from "./-extract-text";

interface ExtractionPassParams {
	text: string;
	fileName: string;
	config: ProviderConfig;
	agentRuns: ReturnType<typeof createAgentRunWriter>;
	onWarning: (message: string) => void;
	log: Pick<PipelineLogger, "error">;
	stageId: string;
	stageLabel: string;
}

export interface ExtractionPassResult {
	result: ExamIngestResponse;
	stageStatus: IngestAgentResolvedStatus;
	stageStatusMessage: string;
}

export async function runExtractionPass(
	params: ExtractionPassParams,
): Promise<ExtractionPassResult> {
	const {
		text,
		fileName,
		config,
		agentRuns,
		onWarning,
		log,
		stageId,
		stageLabel,
	} = params;

	const examName = parseExamNameFromFileName(fileName);
	const expectedQuestionCount = estimateSourceQuestionCount(text);
	const systemPrompt = buildSystemPrompt({ enableWebVerification: false });
	const userPrompt = buildExtractionUserPrompt(text, {
		fileName,
		examName,
		expectedQuestionCount,
	});
	const run = agentRuns.createRun(stageId, stageLabel);
	const emit = createAgentEventEmitter(agentRuns, run, {
		onWarning: (message) => onWarning(message),
	});
	const workspace = createExtractionWorkspace({ examName });
	let stoppedAfterDuplicateAdd = false;
	let stageStatusReport: IngestAgentStageStatusReport | null = null;
	let reportedStageStatus: IngestAgentReportedStatus | null = null;
	const toolFailureMessages: string[] = [];

	const tools = createIngestExtractionTools(workspace, {
		onToolExecuted: async ({ toolName, output }) => {
			const toolFailure = readToolFailureMessage(output);
			if (toolFailure) {
				toolFailureMessages.push(toolFailure);
			}
			if (
				toolName === "add_extracted_question" &&
				typeof output === "object" &&
				output !== null &&
				(output as { alreadyExists?: boolean }).alreadyExists === true
			) {
				stoppedAfterDuplicateAdd = true;
			}
		},
		onStageStatusReported: async ({ output }) => {
			const report = readIngestAgentStageStatusReport(output);
			stageStatusReport = report;
			reportedStageStatus = report?.status ?? null;
		},
	});

	const agentResult = await runPipelineToolAgent({
		scope: "ingest.extraction",
		stageId,
		config,
		run,
		emit,
		systemPrompt,
		messages: [{ role: "user", content: userPrompt }],
		tools: tools as ToolSet,
		stopWhen: buildIngestExtractionStopWhen(INGEST_EXTRACTION_MAX_STEPS, {
			expectedQuestionCount,
		}),
		prepareStep: buildExtractionPrepareStep(workspace, {
			expectedQuestionCount,
			shouldFinalize: () => stoppedAfterDuplicateAdd,
		}),
		meta: { stageId, agentRunId: run.agentRunId },
		requestSummary: stageLabel,
		onRecoverableError: (message) => {
			log.error("AI extraction pass recoverable stream error", {
				stage: stageId,
				agentRunId: run.agentRunId,
				label: stageLabel,
				message,
			});
			onWarning(
				`Provider dropped a stream chunk after a tool call (${message}); continuing with extracted questions.`,
			);
		},
		isSuccess: () => workspace.listQuestions().length > 0,
		failureReason: () =>
			toolFailureMessages[0] ??
			"No questions were extracted during the initial ingest pass.",
	});

	if (!agentResult.success) {
		const emptyMessage =
			"No questions were extracted during the initial ingest pass.";
		if (workspace.listQuestions().length === 0) {
			onWarning(emptyMessage);
		}
		log.error("AI extraction pass failed", {
			stage: stageId,
			agentRunId: run.agentRunId,
			label: stageLabel,
			reason: agentResult.reason,
			rawTextLength: agentResult.rawText.length,
		});
		throw new Error(agentResult.reason ?? emptyMessage);
	}

	if (stoppedAfterDuplicateAdd) {
		onWarning(
			"Extraction agent retried an already-registered question; stopped the tool loop and kept the workspace result.",
		);
	}

	const extractionResult = workspace.buildResult();
	const resolvedStageStatus = resolveIngestAgentRunStatus({
		reported: stageStatusReport,
		toolFailureMessages,
		hasSuccessfulWork: extractionResult.questions.length > 0,
		fallbackMessage: `Extracted ${extractionResult.questions.length} question(s) without an explicit stage report.`,
	});

	if (extractionResult.questions.length > 1) {
		onWarning(
			`Extracted ${extractionResult.questions.length} questions — verify the count matches the source exam.`,
		);
	}
	if (extractionResult.questions.length === 0) {
		const message =
			"No questions were extracted during the initial ingest pass.";
		onWarning(message);
		throw new Error(message);
	}

	agentRuns.result(run, extractionResult, agentResult.rawText, {
		toolQuestionCount: workspace.listQuestions().length,
		stageStatusMessage: resolvedStageStatus.message,
	});
	agentRuns.lifecycle(run, resolvedStageStatus.status as AgentRunStatus, {
		meta: {
			examName: extractionResult.examName,
			questionCount: extractionResult.questions.length,
			topicCount: extractionResult.topics.length,
			stageStatusMessage: resolvedStageStatus.message,
			reportedStageStatus,
		},
	});

	return {
		result: extractionResult,
		stageStatus: resolvedStageStatus.status,
		stageStatusMessage: resolvedStageStatus.message,
	};
}
