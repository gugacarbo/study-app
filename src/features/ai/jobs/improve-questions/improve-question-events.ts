import type {
	ImproveBatchPhase,
	ImproveQuestionItemStatus,
	ImproveQuestionStage,
} from "@/lib/job-kinds";

export type ImproveQuestionStreamEvent =
	| { type: "text"; questionId: string; messageId: string; text: string }
	| {
			type: "tool-call";
			questionId: string;
			messageId: string;
			toolCallId: string;
			toolName: string;
			argsText: string;
			state: "running";
	  }
	| {
			type: "tool-result";
			questionId: string;
			messageId: string;
			toolCallId: string;
			result: unknown;
			isError?: boolean;
	  };

export function buildImproveStepMessageId(
	questionId: string,
	stepNumber: number,
): string {
	return `improve:${questionId}:step:${stepNumber}`;
}

export function buildImproveBatchPhaseEvent(phase: ImproveBatchPhase) {
	return {
		type: "data-improve-batch-phase" as const,
		data: { phase },
	};
}

export function buildImproveQuestionStageEvent(
	questionId: string,
	stage: ImproveQuestionStage,
) {
	return {
		type: "data-improve-question-stage" as const,
		data: { questionId, stage },
	};
}

export function buildImproveQuestionStatusEvent(input: {
	questionId: string;
	status: ImproveQuestionItemStatus;
	summary?: string | null;
	error?: string | null;
}) {
	return {
		type: "data-improve-question-status" as const,
		data: {
			questionId: input.questionId,
			status: input.status,
			...(input.summary != null ? { summary: input.summary } : {}),
			...(input.error != null ? { error: input.error } : {}),
		},
	};
}

export function buildImproveQuestionWarningEvent(
	questionId: string,
	message: string,
) {
	return {
		type: "data-improve-question-warning" as const,
		data: { questionId, message },
	};
}

export function buildImproveTextEvent(
	questionId: string,
	messageId: string,
	text: string,
): ImproveQuestionStreamEvent {
	return { type: "text", questionId, messageId, text };
}

export function buildImproveToolCallEvent(input: {
	questionId: string;
	messageId: string;
	toolCallId: string;
	toolName: string;
	argsText: string;
}): ImproveQuestionStreamEvent {
	return {
		type: "tool-call",
		questionId: input.questionId,
		messageId: input.messageId,
		toolCallId: input.toolCallId,
		toolName: input.toolName,
		argsText: input.argsText,
		state: "running",
	};
}

export function buildImproveToolResultEvent(input: {
	questionId: string;
	messageId: string;
	toolCallId: string;
	result: unknown;
	isError?: boolean;
}): ImproveQuestionStreamEvent {
	return {
		type: "tool-result",
		questionId: input.questionId,
		messageId: input.messageId,
		toolCallId: input.toolCallId,
		result: input.result,
		...(input.isError ? { isError: true } : {}),
	};
}
