import type { StudyAppDataUIPart } from "@/features/ai/lib/read-job-ui-message-stream";
import {
	consumeJobStream,
	type ConsumeJobStreamRequest,
} from "@/features/ai/lib/read-job-ui-message-stream";
import type {
	AgentRunDataPart,
	JobErrorDataPart,
	JobProgressDataPart,
	JobResultDataPart,
	StageDataPart,
	StudyAppUIMessage,
} from "@/features/ai/types/ui-message-data-parts";
import type { PipelineErrorState } from "../types";
import { createPipelineLogReducer } from "./pipeline-log-reducer";
import type { PipelineLogEntry } from "../types";

export interface RunJobPipelineContext {
	jobError: JobErrorDataPart | null;
	receivedResult: boolean;
}

export interface RunJobPipelineHandlers {
	onAgentRun?: (ctx: RunJobPipelineContext, data: AgentRunDataPart) => void;
	onStage?: (ctx: RunJobPipelineContext, data: StageDataPart) => void;
	onProgress?: (ctx: RunJobPipelineContext, data: JobProgressDataPart) => void;
	onDomainPart?: (ctx: RunJobPipelineContext, part: StudyAppDataUIPart) => void;
	onResult?: (ctx: RunJobPipelineContext, data: JobResultDataPart) => void;
	onLog?: (entry: PipelineLogEntry) => void;
}

export interface RunJobPipelineOptions {
	request: ConsumeJobStreamRequest;
	handlers?: RunJobPipelineHandlers;
	onError?: (error: PipelineErrorState) => void;
	enableAutoLogs?: boolean;
	expectResult?: boolean;
}

export interface RunJobPipelineResult {
	messages: StudyAppUIMessage[];
}

const DOMAIN_PART_TYPES = new Set([
	"data-workspace-update",
	"data-explanation-update",
]);

function isDomainPart(part: StudyAppDataUIPart): boolean {
	return DOMAIN_PART_TYPES.has(part.type);
}

function readHttpStatus(message: string): number | null {
	const match = message.match(/Job stream request failed \((\d+)\)/);
	return match ? Number(match[1]) : null;
}

export function errorToPipelineErrorState(
	error: unknown,
	jobError?: JobErrorDataPart | null,
): PipelineErrorState {
	if (jobError) {
		return {
			message: jobError.message,
			source: "job-error",
			stageId: jobError.stageId,
			agentRunId: jobError.agentRunId,
			retryable: false,
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	const httpStatus = readHttpStatus(message);
	if (httpStatus != null) {
		return {
			message,
			source: "http",
			retryable: httpStatus >= 500 || httpStatus === 429,
		};
	}

	return {
		message,
		source: "stream",
		retryable: true,
	};
}

export async function runJobPipeline(
	options: RunJobPipelineOptions,
): Promise<RunJobPipelineResult> {
	const {
		request,
		handlers = {},
		onError,
		enableAutoLogs = true,
		expectResult = false,
	} = options;

	const ctx: RunJobPipelineContext = {
		jobError: null,
		receivedResult: false,
	};

	const logReducer = enableAutoLogs ? createPipelineLogReducer() : null;

	const emitLog = (entry: PipelineLogEntry | null) => {
		if (!entry) return;
		handlers.onLog?.(entry);
	};

	try {
		const result = await consumeJobStream(request, {
			onData: (part) => {
				if (enableAutoLogs && logReducer) {
					emitLog(logReducer.handleDataPart(part));
				}

				if (part.type === "data-job-error") {
					ctx.jobError = part.data;
				}

				if (part.type === "data-agent-run") {
					handlers.onAgentRun?.(ctx, part.data);
					return;
				}

				if (part.type === "data-stage") {
					handlers.onStage?.(ctx, part.data);
					return;
				}

				if (part.type === "data-job-progress") {
					handlers.onProgress?.(ctx, part.data);
					return;
				}

				if (part.type === "data-job-result") {
					ctx.receivedResult = true;
					handlers.onResult?.(ctx, part.data);
					return;
				}

				if (isDomainPart(part)) {
					handlers.onDomainPart?.(ctx, part);
				}
			},
		});

		if (expectResult && !ctx.receivedResult) {
			const incompleteError: PipelineErrorState = {
				message: "Job stream finished without a job result",
				source: "incomplete",
				retryable: false,
			};
			onError?.(incompleteError);
			throw new Error(incompleteError.message);
		}

		return result;
	} catch (error) {
		const pipelineError = errorToPipelineErrorState(error, ctx.jobError);
		onError?.(pipelineError);
		throw error;
	}
}
