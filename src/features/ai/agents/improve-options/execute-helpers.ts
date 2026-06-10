import type { ImproveOptionsAgentEvent } from "./contracts";

export interface ImproveSingleQuestionOptions {
	tools?: NonNullable<
		Parameters<typeof import("@/features/ai/core/chat-stream").streamChatMessages>[2]
	>["tools"];
	onAgentEvent?: (event: ImproveOptionsAgentEvent) => void;
	onWorkspaceUpdate?: (event: {
		question: import("./contracts").DraftQuestion;
		updatedFields: string[];
	}) => void;
	createAgentRunId?: (label: string) => string;
}

export function emitAgentEvent(
	options: ImproveSingleQuestionOptions,
	event: Omit<ImproveOptionsAgentEvent, "timestamp">,
) {
	options.onAgentEvent?.({
		...event,
		timestamp: Date.now(),
	});
}
