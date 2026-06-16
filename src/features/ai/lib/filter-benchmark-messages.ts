import type { UIMessage } from "ai";
import type { BenchmarkPhaseMetrics } from "@/features/ai/lib/stream-perf-metrics";

export function extractAgentRunIdFromMessageId(
	messageId: string,
): string | null {
	const colonIndex = messageId.lastIndexOf(":");
	if (colonIndex <= 0) return null;
	return messageId.slice(0, colonIndex);
}

function orderedAgentRunIds(messages: UIMessage[]): string[] {
	const runIds: string[] = [];
	const seen = new Set<string>();

	for (const message of messages) {
		const runId = extractAgentRunIdFromMessageId(message.id);
		if (!runId || seen.has(runId)) continue;
		seen.add(runId);
		runIds.push(runId);
	}

	return runIds;
}

function resolvePhaseAgentRunId(
	phaseId: string,
	phases: BenchmarkPhaseMetrics[],
	messages: UIMessage[],
): string | null {
	const phase = phases.find((candidate) => candidate.phaseId === phaseId);
	if (phase?.agentRunId) return phase.agentRunId;

	const phaseIndex = phases.findIndex(
		(candidate) => candidate.phaseId === phaseId,
	);
	if (phaseIndex === -1) return null;

	const runIds = orderedAgentRunIds(messages);
	return runIds[phaseIndex] ?? null;
}

export function filterBenchmarkMessagesByPhase(
	messages: UIMessage[],
	phaseId: string | null,
	phases: BenchmarkPhaseMetrics[],
): UIMessage[] {
	if (!phaseId) return messages;

	const agentRunId = resolvePhaseAgentRunId(phaseId, phases, messages);
	if (!agentRunId) return messages;

	return messages.filter(
		(message) => extractAgentRunIdFromMessageId(message.id) === agentRunId,
	);
}
