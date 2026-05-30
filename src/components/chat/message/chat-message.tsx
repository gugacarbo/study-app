import type { UIMessage } from "@tanstack/ai-client";
import { cn } from "@/lib/utils";
import { ChatMessageMetrics } from "./chat-message-metrics";
import type { AssistantPerfMetrics } from "./chat-message-utils";
import { AgentMessages } from "./parts/agent-messages/agent-messages";
import { UserMessages } from "./parts/user-messages/user-messages";

export type { AssistantPerfMetrics };

export function ChatMessage({
	message,
	metrics,
}: {
	message: UIMessage;
	metrics?: AssistantPerfMetrics;
}) {
	const isUser = message.role === "user";

	return (
		<div
			className={cn(
				"flex flex-col gap-1",
				isUser ? "items-end" : "items-start",
			)}
		>
			<div
				className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
			>
				<div
					className={cn(
						"wrap-break-word whitespace-pre-wrap rounded-lg px-4 py-2 text-sm leading-relaxed",
						isUser
							? "min-w-1/2 md:min-w-2/5 max-w-3/5 bg-primary text-primary-foreground"
							: "w-4/5 max-w-4/5 bg-card border border-border text-card-foreground",
					)}
				>
					{isUser
						? message.parts.map((part) => (
								<UserMessages key={message.id} part={part} />
							))
						: message.parts.map((part) => (
								<AgentMessages key={message.id} part={part} />
							))}
				</div>
			</div>
			<ChatMessageMetrics metrics={metrics} show={!isUser} />
		</div>
	);
}
