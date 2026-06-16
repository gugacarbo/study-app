import {
	type JobUIMessageStreamWriter,
	writeStage,
} from "@/features/ai/core/ui-message-job-stream";
import type { StageStatus } from "@/features/ai/types/ui-message-data-parts";
import { createPipelineLogger, type PipelineLogger } from "./pipeline-logger";

export interface PipelineStageDescriptor {
	stageId: string;
	label: string;
}

export type PipelineStageOutcome = Extract<
	StageStatus,
	"done" | "warning" | "skipped"
>;

export interface RunPipelineStageOptions {
	fatal?: boolean;
	log?: PipelineLogger;
	ctx?: { stageId?: string; agentRunId?: string };
	meta?: Record<string, unknown>;
}

function normalizeErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function runPipelineStage(
	writer: JobUIMessageStreamWriter,
	stage: PipelineStageDescriptor,
	work: () => Promise<PipelineStageOutcome> | PipelineStageOutcome,
	options?: RunPipelineStageOptions,
): Promise<PipelineStageOutcome | "error"> {
	const { fatal = true, ctx } = options ?? {};
	const log =
		options?.log ?? createPipelineLogger(writer, { stageId: stage.stageId });

	if (ctx) {
		ctx.stageId = stage.stageId;
	}

	log.info(`${stage.label}: running`);
	writeStage(writer, {
		stageId: stage.stageId,
		label: stage.label,
		status: "running",
		timestamp: Date.now(),
		meta: options?.meta,
	});

	try {
		const result = await work();

		log.info(`${stage.label}: ${result}`);
		writeStage(writer, {
			stageId: stage.stageId,
			label: stage.label,
			status: result,
			timestamp: Date.now(),
		});

		return result;
	} catch (error) {
		const message = normalizeErrorMessage(error);
		log.error(`${stage.label}: error`, { error: message });
		writeStage(writer, {
			stageId: stage.stageId,
			label: stage.label,
			status: "error",
			timestamp: Date.now(),
			meta: { error: message },
		});

		if (fatal) {
			throw error;
		}
		return "error";
	}
}
