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
	const systemMessage = createTextMessage(
		"agent-system",
		"system",
		systemPrompt,
	);
	const userMessage = createTextMessage("agent-user", "user", userPrompt);
	const assistantMessage = createTextMessage(
		"agent-assistant",
		"assistant",
		response,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[92vh] w-[98vw] max-w-[98vw] flex-col border-border bg-card p-6 text-foreground sm:h-[90vh] sm:max-w-350">
				<DialogHeader>
					<DialogTitle>{name}</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{summary ?? "Inspect prompts, response, and agent state."}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-2 min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3">
					<div className="flex flex-col gap-3 pr-1">
						{systemMessage ? <SystemMessage message={systemMessage} /> : null}
						{userMessage ? <UserMessage message={userMessage} /> : null}
						{assistantMessage ? (
							<ChatMessage message={assistantMessage} />
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function createTextMessage(
	id: string,
	role: UIMessage["role"],
	content?: string,
): UIMessage | null {
	if (!content) return null;

	return {
		id,
		role,
		parts: [{ type: "text", content }],
	};
}
