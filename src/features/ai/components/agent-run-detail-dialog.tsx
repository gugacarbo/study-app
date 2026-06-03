import type { UIMessage } from "@tanstack/ai-client";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ChatMessage } from "@/features/ai/components/chat/message/chat-message";
import { SystemMessage } from "@/features/ai/components/chat/message/system-message";
import { UserMessage } from "@/features/ai/components/chat/message/user-message";

interface AgentRunDetailDialogProps {
	name: string;
	summary?: string;
	systemPrompt?: string;
	userPrompt?: string;
	response?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AgentRunDetailDialog({
	name,
	summary,
	systemPrompt,
	userPrompt,
	response,
	open,
	onOpenChange,
}: AgentRunDetailDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[92vh] w-[98vw] max-w-[98vw] flex-col border-border bg-card p-6 text-foreground sm:h-[90vh] sm:max-w-350">
				<DialogHeader>
					<DialogTitle>{name}</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{summary ?? "Inspect prompts, response, and agent state."}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-2 min-h-0 flex-1 overflow-auto">
					<div className="flex flex-col gap-3 pr-1">
						<SystemMessage
							message={{
								id: "agent-system",
								role: "system",
								parts: [{ type: "text", content: systemPrompt ?? "" }],
							}}
						/>
						<UserMessage
							message={{
								id: "agent-user",
								role: "user",
								parts: [{ type: "text", content: userPrompt ?? "" }],
							}}
						/>
						<AgentMessageBubble
							messageRole="assistant"
							label="Agent response"
							content={response}
						/>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function AgentMessageBubble({
	messageRole,
	label,
	content,
}: {
	messageRole: "assistant";
	label: string;
	content?: string;
}) {
	if (!content) return null;

	const uiMessage: UIMessage = {
		id: `agent-${messageRole}`,
		role: messageRole,
		parts: [{ type: "text", content }],
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="px-1 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<ChatMessage message={uiMessage} />
		</div>
	);
}
