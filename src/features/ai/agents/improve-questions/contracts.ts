import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import type { AgentRunEvent } from "@/routes/api/ingest/-sse-emitter";

export const IMPROVE_QUESTIONS_STAGE_ID = "improve-questions" as const;

export const GET_QUESTION_TOOL = "get_question" as const;
export const UPDATE_QUESTION_OPTIONS_TOOL = "update_question_options" as const;

/** Editable question snapshot for the improve-questions workspace and UI draft. */
export type DraftQuestion = Pick<
	QuestionData,
	"id" | "question" | "options" | "answers" | "scoringMode" | "explanation"
> & {
	exam_id?: QuestionData["exam_id"];
	deepExplanation?: string;
	topic?: string;
};

export type ImproveQuestionsAgentRunStatus =
	| "pending"
	| "running"
	| "done"
	| "error";

export interface ImproveQuestionsAgentRunSummary {
	agentRunId: string;
	label: string;
	status: ImproveQuestionsAgentRunStatus;
	systemPrompt: string;
	userPrompt: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	meta?: Record<string, unknown>;
}

/** Agent lifecycle/tool events streamed as SSE `agent` payloads. */
export type ImproveQuestionsAgentEvent = Omit<AgentRunEvent, "stageId"> & {
	stageId: typeof IMPROVE_QUESTIONS_STAGE_ID;
};

export interface WorkspaceUpdateEvent {
	question: DraftQuestion;
	updatedFields: string[];
}

export interface ImproveQuestionsDoneEvent {
	finalQuestion: DraftQuestion;
	agentRun: ImproveQuestionsAgentRunSummary;
}

export interface ImproveQuestionsErrorEvent {
	message: string;
}

export type ImproveQuestionsSSEEvent =
	| { event: "agent"; data: ImproveQuestionsAgentEvent }
	| { event: "workspace-update"; data: WorkspaceUpdateEvent }
	| { event: "done"; data: ImproveQuestionsDoneEvent }
	| { event: "error"; data: ImproveQuestionsErrorEvent };

export type ChangeField = "question" | "options" | "answer" | "explanation";

export type ChangeDecision = "pending" | "keep" | "revert";

export interface QuestionChange {
	id: string;
	field: ChangeField;
	/** Per-option granularity for changed or added options. */
	optionIndex?: number;
	label: string;
	before: string;
	after: string;
	decision: ChangeDecision;
}
