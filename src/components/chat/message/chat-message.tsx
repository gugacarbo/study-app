import type { UIMessage } from "@tanstack/ai-client";
import { cn } from "@/lib/utils";
import { ChatMessageMetrics } from "./chat-message-metrics";
import { ChatMessageTextPart } from "./chat-message-text-part";
import { ChatMessageThinking } from "./chat-message-thinking";
import { ChatMessageToolCall } from "./chat-message-tool-call";
import { ChatMessageToolResult } from "./chat-message-tool-result";
import type { AssistantPerfMetrics } from "./chat-message-utils";

export type { AssistantPerfMetrics };

export function ChatMessage({
	message,
	metrics,
}: {
	message: UIMessage;
	metrics?: AssistantPerfMetrics;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1",
				message.role === "user" ? "items-end" : "items-start",
			)}
		>
			<div
				className={cn(
					"flex w-full",
					message.role === "user" ? "justify-end" : "justify-start",
				)}
			>
				<div
					className={cn(
						"wrap-break-word whitespace-pre-wrap rounded-lg px-4 py-2 text-sm leading-relaxed",
						message.role === "user"
							? "min-w-1/2 md:min-w-2/5 max-w-3/5 bg-primary text-primary-foreground"
							: "w-4/5 max-w-4/5 bg-card border border-border text-card-foreground",
					)}
				>
					{message.parts.map((part, partIndex) => {
						const itemKey = `${message.id}:${partIndex}`;
						return part.type === "text" ? (
							<ChatMessageTextPart
								key={itemKey}
								part={part}
								role={message.role as "user" | "assistant"}
							/>
						) : part.type === "thinking" ? (
							<ChatMessageThinking key={itemKey} part={part} />
						) : part.type === "tool-call" ? (
							<ChatMessageToolCall part={part} key={itemKey} />
						) : part.type === "tool-result" ? (
							<ChatMessageToolResult part={part} key={itemKey} />
						) : null;
					})}
				</div>
			</div>
			{message.role === "assistant" && metrics && (
				<ChatMessageMetrics metrics={metrics} />
			)}
		</div>
	);
}
