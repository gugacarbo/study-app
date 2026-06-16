import type { PipelineErrorState } from "../types";

export interface PipelineErrorProcessFields {
	streamError?: string | PipelineErrorState | null;
	error?: string | null;
	agentRunState?: { error?: string | null };
}

function readErrorMessage(
	value: string | PipelineErrorState | null | undefined,
): string | null {
	if (value == null) return null;
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	const trimmed = value.message.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function resolvePipelineError(
	process: PipelineErrorProcessFields,
): string | null {
	const streamError = readErrorMessage(process.streamError);
	if (streamError) return streamError;

	const jobError = readErrorMessage(process.error);
	if (jobError) return jobError;

	const agentError = readErrorMessage(process.agentRunState?.error ?? null);
	if (agentError) return agentError;

	return null;
}
