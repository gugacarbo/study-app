import type { UIMessage } from "@tanstack/ai-client";
import { useStore } from "@tanstack/react-store";
import {
	backgroundProcessStore,
	ingestProcessId,
	isIngestProcess,
	type IngestBackgroundProcess,
} from "@/features/background-processes";
import { ensureAgentRunMessages } from "@/features/ingest/store";

export function useLiveAgentMessages(
	jobId: string | undefined,
	agentRunId: string | undefined,
	fallback: UIMessage[] | undefined,
): UIMessage[] | undefined {
	return useStore(backgroundProcessStore, (state) => {
		if (!jobId || !agentRunId) {
			return fallback;
		}

		const process = state.processes.find(
			(candidate): candidate is IngestBackgroundProcess =>
				candidate.id === ingestProcessId(jobId) && isIngestProcess(candidate),
		);
		const agentRun = process?.agentRuns.find(
			(candidate) => candidate.id === agentRunId,
		);
		if (!agentRun) {
			return fallback;
		}

		return ensureAgentRunMessages(agentRun).messages;
	});
}
