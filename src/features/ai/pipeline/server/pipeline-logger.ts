import {
	type JobUIMessageStreamWriter,
	writeJobProgress,
	writeProcessLog,
} from "@/features/ai/core/ui-message-job-stream";
import type { PipelineLogLevel } from "@/features/ai/pipeline/types";

export interface PipelineLoggerContext {
	stageId?: string;
	agentRunId?: string;
}

export interface PipelineLogger {
	debug(message: string, data?: unknown): void;
	info(message: string, data?: unknown): void;
	warning(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
	step(message: string, percent?: number): void;
	withContext(partial: PipelineLoggerContext): PipelineLogger;
}

export function createPipelineLogger(
	writer: JobUIMessageStreamWriter,
	context: PipelineLoggerContext,
): PipelineLogger {
	const emit = (level: PipelineLogLevel, message: string, data?: unknown) => {
		writeProcessLog(writer, {
			level,
			message,
			stageId: context.stageId,
			agentRunId: context.agentRunId,
			data,
		});
	};

	return {
		debug: (message, data) => emit("debug", message, data),
		info: (message, data) => emit("info", message, data),
		warning: (message, data) => emit("warning", message, data),
		error: (message, data) => emit("error", message, data),
		step(message, percent) {
			writeJobProgress(writer, {
				step: message,
				percent,
				stageId: context.stageId,
				agentRunId: context.agentRunId,
			});
			emit("info", message);
		},
		withContext(partial) {
			return createPipelineLogger(writer, { ...context, ...partial });
		},
	};
}
