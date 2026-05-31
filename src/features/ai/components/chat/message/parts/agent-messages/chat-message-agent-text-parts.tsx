import { parseTextParts } from "../../chat-message-utils";
import { ChatMessageTextPart } from "../chat-message-text-part";
import { ChatMessageThinking } from "./chat-message-thinking";

interface ChatMessageAgentTextPartsProps {
	content: string;
}

export function ChatMessageAgentTextParts({
	content,
}: ChatMessageAgentTextPartsProps) {
	return (
		<div className="flex flex-col gap-2">
			{parseTextParts(content).map((parsedPart) =>
				parsedPart.type === "text" ? (
					<ChatMessageTextPart
						key={parsedPart.content}
						content={parsedPart.content}
						msgRole="assistant"
					/>
				) : (
					<ChatMessageThinking
						key={parsedPart.content}
						content={parsedPart.content}
						isPending={Boolean(parsedPart.incomplete)}
					/>
				),
			)}
		</div>
	);
}
