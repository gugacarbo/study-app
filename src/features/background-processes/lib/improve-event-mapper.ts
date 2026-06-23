import {
	type MappedThreadMessage,
	mergeJobEvents,
	type PendingToolResultsState,
	type StreamPartsState,
} from "@/features/background-processes/lib/ingest-event-mapper";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import type {
	ImproveBatchPhase,
	ImproveQuestionItemStatus,
	ImproveQuestionStage,
	ImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

export type ImproveQuestionActivityState = {
	questionId: string;
	questionNumber: number;
	status: ImproveQuestionItemStatus;
	stage: ImproveQuestionStage;
	summary?: string;
	error?: string;
	warnings: string[];
	messages: MappedThreadMessage[];
	events: JobEventRecord[];
	lastSeq: number;
	streamParts?: StreamPartsState;
	streamFirstSeq?: Map<string, number>;
	pendingToolResults?: PendingToolResultsState;
};

export type ImproveMonitorState = {
	batchPhase: ImproveBatchPhase | null;
	questions: ImproveQuestionActivityState[];
};

export function isImproveQuestionsJobMetadata(
	metadata: unknown,
): metadata is ImproveQuestionsJobMetadata {
	return (
		typeof metadata === "object" &&
		metadata != null &&
		Array.isArray((metadata as { questionIds?: unknown }).questionIds) &&
		Array.isArray((metadata as { items?: unknown }).items)
	);
}

function createInitialQuestionState(
	metadata: ImproveQuestionsJobMetadata,
): ImproveMonitorState["questions"] {
	return metadata.items.map((item) => ({
		questionId: item.questionId,
		questionNumber: item.questionNumber,
		status: item.status,
		stage: item.stage,
		summary: item.summary,
		error: item.error,
		warnings: [],
		messages: [],
		events: [],
		lastSeq: 0,
		streamParts: undefined,
		streamFirstSeq: undefined,
		pendingToolResults: undefined,
	}));
}

function isImproveQuestionStreamPayload(payload: unknown): payload is {
	questionId: string;
	type: "text" | "tool-call" | "tool-result";
} {
	return (
		typeof payload === "object" &&
		payload != null &&
		typeof (payload as { questionId?: unknown }).questionId === "string" &&
		((payload as { type?: unknown }).type === "text" ||
			(payload as { type?: unknown }).type === "tool-call" ||
			(payload as { type?: unknown }).type === "tool-result")
	);
}

function getQuestionStateIndex(
	questions: ImproveQuestionActivityState[],
	questionId: string,
): number {
	return questions.findIndex((question) => question.questionId === questionId);
}

export function mergeImproveJobEvents(input: {
	current?: ImproveMonitorState | null;
	metadata: ImproveQuestionsJobMetadata;
	incoming: JobEventRecord[];
	isJobTerminal?: boolean;
}): ImproveMonitorState {
	const baseQuestions = input.current?.questions
		? input.metadata.items.map((item) => {
				const existing = input.current?.questions.find(
					(question) => question.questionId === item.questionId,
				);
				return existing
					? {
							...existing,
							questionNumber: item.questionNumber,
							status: item.status,
							stage: item.stage,
							summary: item.summary ?? existing.summary,
							error: item.error ?? existing.error,
						}
					: {
						questionId: item.questionId,
						questionNumber: item.questionNumber,
						status: item.status,
						stage: item.stage,
						summary: item.summary,
						error: item.error,
						warnings: [],
						messages: [],
						events: [],
						lastSeq: 0,
						streamParts: undefined,
						streamFirstSeq: undefined,
						pendingToolResults: undefined,
					};
			})
		: createInitialQuestionState(input.metadata);

	let batchPhase = input.current?.batchPhase ?? null;
	const questions = [...baseQuestions];

	for (const event of input.incoming) {
		const payload = event.payload;

		if (
			typeof payload === "object" &&
			payload != null &&
			(payload as { type?: unknown }).type === "data-improve-batch-phase"
		) {
			const phase = (payload as { data?: { phase?: ImproveBatchPhase } }).data?.phase;
			if (phase) batchPhase = phase;
			continue;
		}

		if (
			typeof payload === "object" &&
			payload != null &&
			(payload as { type?: unknown }).type === "data-improve-question-stage"
		) {
			const data = (payload as {
				data?: { questionId?: string; stage?: ImproveQuestionStage };
			}).data;
			if (!data?.questionId || !data.stage) continue;
			const index = getQuestionStateIndex(questions, data.questionId);
			if (index >= 0) {
				questions[index] = {
					...questions[index],
					stage: data.stage,
					events: [...questions[index].events, event],
				};
			}
			continue;
		}

		if (
			typeof payload === "object" &&
			payload != null &&
			(payload as { type?: unknown }).type === "data-improve-question-status"
		) {
			const data = (payload as {
				data?: {
					questionId?: string;
					status?: ImproveQuestionItemStatus;
					summary?: string;
					error?: string;
				};
			}).data;
			if (!data?.questionId || !data.status) continue;
			const index = getQuestionStateIndex(questions, data.questionId);
			if (index >= 0) {
				questions[index] = {
					...questions[index],
					status: data.status,
					summary: data.summary ?? questions[index].summary,
					error: data.error ?? questions[index].error,
					events: [...questions[index].events, event],
				};
			}
			continue;
		}

		if (
			typeof payload === "object" &&
			payload != null &&
			(payload as { type?: unknown }).type === "data-improve-question-warning"
		) {
			const data = (payload as {
				data?: { questionId?: string; message?: string };
			}).data;
			if (!data?.questionId || !data.message) continue;
			const index = getQuestionStateIndex(questions, data.questionId);
			if (index >= 0) {
				questions[index] = {
					...questions[index],
					warnings: [...questions[index].warnings, data.message],
					events: [...questions[index].events, event],
				};
			}
			continue;
		}

		if (!isImproveQuestionStreamPayload(payload)) {
			continue;
		}

		const index = getQuestionStateIndex(questions, payload.questionId);
		if (index < 0) continue;

		const current = questions[index];
		const merged = mergeJobEvents(
			{
				messages: current.messages,
				progress: {
					phase: null,
					questionsSeen: 0,
					extracted: null,
					persisted: null,
					skippedDuplicate: null,
					invalid: null,
					extractedQuestionsPreview: [],
				},
				lastSeq: current.lastSeq,
				events: current.events,
				streamParts: current.streamParts,
				streamFirstSeq: current.streamFirstSeq,
				pendingToolResults: current.pendingToolResults,
				isJobTerminal: input.isJobTerminal,
			},
			[event],
		);

		questions[index] = {
			...current,
			messages: merged.messages,
			events: merged.events,
			lastSeq: merged.lastSeq,
			streamParts: merged.streamParts,
			streamFirstSeq: merged.streamFirstSeq,
			pendingToolResults: merged.pendingToolResults,
		};
	}

	return {
		batchPhase,
		questions,
	};
}
