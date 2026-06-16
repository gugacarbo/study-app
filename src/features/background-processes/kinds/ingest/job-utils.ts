import type { UIMessage } from "ai";
import type { IngestAgentRun, IngestJob } from "@/features/ingest/store/types";
import { createEmptyTotals } from "@/features/ingest/store/types";

type AgentRole = "system" | "user" | "assistant";

function createTextPart(text: string) {
	return { type: "text" as const, text };
}

function createAgentMessage(
	agentRunId: string,
	role: AgentRole,
	content: string,
): UIMessage {
	return {
		id: `${agentRunId}:${role}`,
		role,
		parts: [createTextPart(content)],
	};
}

function createAgentMessages(
	agentRunId: string,
	systemPrompt: string,
	userPrompt: string,
	assistantText: string,
): UIMessage[] {
	const messages: UIMessage[] = [];
	if (systemPrompt) {
		messages.push(createAgentMessage(agentRunId, "system", systemPrompt));
	}
	if (userPrompt) {
		messages.push(createAgentMessage(agentRunId, "user", userPrompt));
	}
	messages.push(createAgentMessage(agentRunId, "assistant", assistantText));
	return messages;
}

function createMissingAgentMessages(agentRun: IngestAgentRun): UIMessage[] {
	return createAgentMessages(
		agentRun.id,
		agentRun.systemPrompt,
		agentRun.userPrompt,
		agentRun.outputText,
	);
}

export function createEmptyJob(
	id: string,
	fileName: string,
	buffer: number[],
	enableReview: boolean,
	enableExplanations = true,
	agentConcurrency = 10,
): IngestJob {
	return {
		id,
		fileName,
		status: "queued",
		createdAt: Date.now(),
		startedAt: null,
		finishedAt: null,
		stepText: "",
		logs: [],
		outputEntries: [],
		agentRuns: [],
		tokenTotals: createEmptyTotals(),
		nonAgentTokenTotals: createEmptyTotals(),
		warnings: [],
		result: null,
		error: null,
		stages: [],
		buffer,
		enableReview,
		enableExplanations,
		agentConcurrency,
		rawStreamText: "",
	};
}

export function ensureAgentRunMessages(
	agentRun: IngestAgentRun,
): IngestAgentRun {
	if (Array.isArray(agentRun.messages) && agentRun.messages.length > 0) {
		return agentRun;
	}
	return {
		...agentRun,
		messages: createMissingAgentMessages(agentRun),
	};
}
