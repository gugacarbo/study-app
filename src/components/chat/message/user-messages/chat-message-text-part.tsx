import type { MessagePart } from "@tanstack/ai-client";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { bubbleMarkdownClass, parseTextParts } from "../chat-message-utils";
import { DetailAccordion } from "../detail-accordion";

interface ChatMessageTextPartProps {
	part: Extract<MessagePart, { type: "text" }>;
	msgRole: "user" | "assistant";
}

export function ChatMessageTextPart({
	part,
	msgRole,
}: ChatMessageTextPartProps) {
	const keyOccurrences = new Map<string, number>();

	return (
		<div className="flex flex-col gap-2">
			{parseTextParts(part.content).map((parsedPart) => {
				const baseKey = `${parsedPart.type}:${parsedPart.content}`;
				const occurrence = keyOccurrences.get(baseKey) ?? 0;
				keyOccurrences.set(baseKey, occurrence + 1);
				const partKey = `${baseKey}:${occurrence}`;

				return parsedPart.type === "text" ? (
					<MarkdownRenderer
						key={partKey}
						content={parsedPart.content}
						className={bubbleMarkdownClass(msgRole)}
					/>
				) : (
					<DetailAccordion
						key={partKey}
						value="think"
						label="Raciocínio"
						tone="neutral"
						className="border-0 px-0"
					>
						<p className="whitespace-pre-wrap text-xs text-muted-foreground">
							{parsedPart.content}
						</p>
					</DetailAccordion>
				);
			})}
		</div>
	);
}
