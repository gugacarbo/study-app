import type { LanguageModelUsage, TextStreamPart, ToolSet } from "ai";

export type ChatMessageMetadata = {
	usage?: LanguageModelUsage;
	steps?: Array<{ usage: LanguageModelUsage }>;
};

export function extractChatMessageMetadata(
	part: TextStreamPart<ToolSet>,
): ChatMessageMetadata | undefined {
	if (part.type === "finish") {
		return { usage: part.totalUsage };
	}

	if (part.type === "finish-step") {
		return { steps: [{ usage: part.usage }] };
	}

	return undefined;
}
