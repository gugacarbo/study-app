import { MarkdownRenderer } from "@/components/ui/markdown";
import { bubbleMarkdownClass } from "../chat-message-utils";

interface ChatMessageTextPartProps {
	content: string;
	msgRole: "user" | "assistant";
}

export function ChatMessageTextPart({
	content,
	msgRole,
}: ChatMessageTextPartProps) {
	return (
		<MarkdownRenderer
			content={content}
			className={bubbleMarkdownClass(msgRole)}
		/>
	);
}
