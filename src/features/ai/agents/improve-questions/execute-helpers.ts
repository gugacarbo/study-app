import type { ImproveQuestionsAgentEvent } from "./contracts";

export interface ImproveSingleQuestionOptions {
	tools?: NonNullable<
		Parameters<typeof import("@/features/ai/core/chat-stream").streamChatMessages>[2]
	>["tools"];
	onAgentEvent?: (event: ImproveQuestionsAgentEvent) => void;
	onWorkspaceUpdate?: (event: {
		question: import("./contracts").DraftQuestion;
		updatedFields: string[];
	}) => void;
	createAgentRunId?: (label: string) => string;
}

export function emitAgentEvent(
	options: ImproveSingleQuestionOptions,
	event: Omit<ImproveQuestionsAgentEvent, "timestamp">,
) {
	options.onAgentEvent?.({
		...event,
		timestamp: Date.now(),
	});
}
