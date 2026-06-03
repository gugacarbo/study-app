import { z } from "zod";

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

export interface ExplanationBatchInput {
	id: number;
	question: string;
	options: string[];
	answer: string;
	topic?: string;
	explanation?: string;
}

export type ExplanationAgentRunStatus =
	| "pending"
	| "running"
	| "done"
	| "error";

export interface ExplanationAgentRunEvent {
	eventType: "lifecycle" | "result";
	stageId: "explanations";
	agentRunId: string;
	label: string;
	status?: ExplanationAgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: ExplanationBatchResult;
	error?: string;
	meta?: {
		questionCount: number;
		questionIds: number[];
	};
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
	meta?: {
		questionCount: number;
		questionIds: number[];
	};
}

export interface RunBatchQuestionExplanationsOptions {
	memoryContext?: string;
	tools?: unknown;
	onAgentEvent?: (event: ExplanationAgentRunEvent) => void;
	createAgentRunId?: (label: string) => string;
}
