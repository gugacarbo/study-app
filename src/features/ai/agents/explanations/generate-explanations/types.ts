import { z } from "zod";
import type {
	AgentStreamToolCallPayload,
	AgentStreamToolResultPayload,
} from "@/features/ai/core/agent-stream-handler";

export const explanationBatchSchema = z.object({
	questions: z.array(
		z.object({
			id: z.number().int().positive(),
			explanation: z.string().min(1),
			deepExplanation: z.string().min(1),
		}),
	),
});

export type ExplanationBatchResult = z.infer<typeof explanationBatchSchema>;
export type ExplanationQuestionResult =
	ExplanationBatchResult["questions"][number];

export interface ExplanationBatchInput {
	id: number;
	question: string;
	options: string[];
	answer: string;
	topic?: string;
	explanation?: string;
}

type ExplanationAgentRunStatus = "pending" | "running" | "done" | "error";

interface ExplanationAgentRunMeta {
	questionIndex?: number;
	questionNumber?: number;
	questionCount?: number;
	questionIds?: number[];
	topic?: string;
	toolCallId?: string;
}

export interface ExplanationAgentRunEvent {
	eventType:
		| "lifecycle"
		| "result"
		| "warning"
		| "token"
		| "tool-call"
		| "tool-result";
	stageId: "explanations";
	agentRunId: string;
	label: string;
	status?: ExplanationAgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: ExplanationQuestionResult;
	error?: string;
	warning?: string;
	tokens?: unknown;
	meta?: ExplanationAgentRunMeta;
	name?: string;
	arguments?: string;
	input?: unknown;
	state?: string;
	content?: unknown;
}

export interface ExplanationAgentRunSummary {
	agentRunId: string;
	label: string;
	status: ExplanationAgentRunStatus;
	systemPrompt: string;
	userPrompt: string;
	rawText?: string;
	finalObject?: ExplanationBatchResult;
	error?: string;
	meta?: ExplanationAgentRunMeta;
}

export interface RunQuestionExplanationsOptions {
	/** @deprecated Prefer resolveMemoryContext for per-question topic scoping. */
	memoryContext?: string;
	resolveMemoryContext?: (
		question: ExplanationBatchInput,
	) => string | undefined;
	concurrency?: number;
	tools?: unknown;
	onProgress?: (event: { message: string }) => void;
	onAgentEvent?: (event: ExplanationAgentRunEvent) => void;
	onToolCall?: (
		event: {
			agentRunId: string;
			label: string;
			stageId: "explanations";
		} & AgentStreamToolCallPayload,
	) => void;
	onToolResult?: (
		event: {
			agentRunId: string;
			label: string;
			stageId: "explanations";
		} & AgentStreamToolResultPayload,
	) => void;
	createAgentRunId?: (label: string) => string;
}

/** @deprecated Use RunQuestionExplanationsOptions */
export type RunBatchQuestionExplanationsOptions =
	RunQuestionExplanationsOptions;
