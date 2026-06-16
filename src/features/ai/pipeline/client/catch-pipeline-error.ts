import type { PipelineErrorState } from "../types";
import { errorToPipelineErrorState } from "./run-job-pipeline";

export function isAbortError(error: unknown): boolean {
	if (error instanceof DOMException && error.name === "AbortError") {
		return true;
	}
	return error instanceof Error && error.name === "AbortError";
}

export interface CatchPipelineErrorPatch {
	streamError?: string | null;
	phase?: "error" | "canceled";
	isStreaming?: boolean;
	agentRunState?: { status?: "error"; error?: string | null };
}

export function catchPipelineError(
	error: unknown,
	signal: AbortSignal | undefined,
	patchProcess: (patch: CatchPipelineErrorPatch) => void,
	options?: {
		agentRunState?: { status?: string; error?: string | null };
	},
): PipelineErrorState | null {
	if (signal?.aborted || isAbortError(error)) {
		patchProcess({
			phase: "canceled",
			isStreaming: false,
			streamError: null,
		});
		return null;
	}

	const pipelineError = errorToPipelineErrorState(error);
	const message = pipelineError.message;

	patchProcess({
		streamError: message,
		phase: "error",
		isStreaming: false,
		...(options?.agentRunState
			? {
					agentRunState: {
						...options.agentRunState,
						status: "error",
						error: message,
					},
				}
			: {}),
	});

	return pipelineError;
}
