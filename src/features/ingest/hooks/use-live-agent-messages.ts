import { useStore } from "@tanstack/react-store";
import type { UIMessage } from "ai";
import {
	backgroundProcessStore,
	type IngestBackgroundProcess,
	ingestProcessId,
	isIngestProcess,
} from "@/features/background-processes";
import {
	ensureAgentRunMessages,
	type IngestAgentRun,
} from "@/features/ingest/store";

function findLiveAgentRun(
	state: typeof backgroundProcessStore.state,
	jobId: string | undefined,
	agentRunId: string | undefined,
): IngestAgentRun | undefined {
	if (!jobId || !agentRunId) {
		return undefined;
	}

	const process = state.processes.find(
		(candidate): candidate is IngestBackgroundProcess =>
			candidate.id === ingestProcessId(jobId) && isIngestProcess(candidate),
	);
	const agentRun = process?.agentRuns.find(
		(candidate) => candidate.id === agentRunId,
	);
	return agentRun ? ensureAgentRunMessages(agentRun) : undefined;
}

export function useLiveAgentRun(
	jobId: string | undefined,
	agentRunId: string | undefined,
): IngestAgentRun | undefined {
	return useStore(backgroundProcessStore, (state) =>
		findLiveAgentRun(state, jobId, agentRunId),
	);
}

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
