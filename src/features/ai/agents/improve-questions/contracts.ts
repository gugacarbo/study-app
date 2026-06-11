import type { ToolSet } from "ai";
import type {
	AgentRunDataPart,
	WorkspaceUpdateDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

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

/** Agent lifecycle/tool events written as `data-agent-run` parts. */
export type ImproveQuestionsAgentEvent = AgentRunDataPart & {
	stageId: typeof IMPROVE_QUESTIONS_STAGE_ID;
};

export interface WorkspaceUpdateEvent {
	question: DraftQuestion;
	updatedFields: string[];
}

export interface ImproveQuestionsJobResult {
	finalQuestion: DraftQuestion;
	agentRun: ImproveQuestionsAgentRunSummary;
}

/** @deprecated Use ImproveQuestionsJobResult */
export type ImproveQuestionsDoneEvent = ImproveQuestionsJobResult;

export interface ImproveQuestionsErrorEvent {
	message: string;
}

/** @deprecated Legacy SSE shape — client migrates to UI Message Stream in Wave 4C. */
export type ImproveQuestionsSSEEvent =
	| { event: "agent"; data: ImproveQuestionsAgentEvent }
	| { event: "workspace-update"; data: WorkspaceUpdateEvent }
	| { event: "done"; data: ImproveQuestionsJobResult }
	| { event: "error"; data: ImproveQuestionsErrorEvent };

export interface ImproveSingleQuestionOptions {
	tools?: ToolSet;
	onAgentEvent?: (event: ImproveQuestionsAgentEvent) => void;
	onWorkspaceUpdate?: (event: WorkspaceUpdateEvent) => void;
	createAgentRunId?: (label: string) => string;
}

export function emitAgentEvent(
	options: Pick<ImproveSingleQuestionOptions, "onAgentEvent">,
	event: Omit<ImproveQuestionsAgentEvent, "timestamp">,
): void {
	options.onAgentEvent?.({
		...event,
		timestamp: Date.now(),
	});
}

export function toWorkspaceUpdateDataPart(
	event: WorkspaceUpdateEvent,
): WorkspaceUpdateDataPart {
	return {
		question: {
			id: String(event.question.id),
			question: event.question.question,
			options: [...event.question.options],
			answers: [...event.question.answers],
			scoringMode: event.question.scoringMode,
			explanation: event.question.explanation,
			deepExplanation: event.question.deepExplanation,
			topic: event.question.topic,
			exam_id:
				event.question.exam_id != null
					? String(event.question.exam_id)
					: undefined,
		},
		updatedFields: event.updatedFields,
	};
}

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
