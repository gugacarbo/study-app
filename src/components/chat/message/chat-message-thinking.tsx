import type { UIMessage } from "@tanstack/ai-client";

interface ChatMessageThinkingProps {
	part: Extract<UIMessage["parts"][number], { type: "thinking" }>;
}

export function ChatMessageThinking({ part }: ChatMessageThinkingProps) {
	return (
		<span className="chat-thinking-part italic text-muted-foreground">
			{part.content}
		</span>
	);
}
