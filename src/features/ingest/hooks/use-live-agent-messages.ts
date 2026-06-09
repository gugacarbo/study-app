import type { UIMessage } from "@tanstack/ai-client";
import { useStore } from "@tanstack/react-store";
import { ensureAgentRunMessages, ingestStore } from "@/features/ingest/store";

export function useLiveAgentMessages(
	jobId: string | undefined,
	agentRunId: string | undefined,
	fallback: UIMessage[] | undefined,
): UIMessage[] | undefined {
	return useStore(ingestStore, (state) => {
		if (!jobId || !agentRunId) {
			return fallback;
		}

		const job = state.jobs.find((candidate) => candidate.id === jobId);
		const agentRun = job?.agentRuns.find(
			(candidate) => candidate.id === agentRunId,
		);
		if (!agentRun) {
			return fallback;
		}

		return ensureAgentRunMessages(agentRun).messages;
	});
}
