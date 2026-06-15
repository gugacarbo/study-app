import { Loader2 } from "lucide-react";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { useFollowUpAssistantRuntime } from "@/features/ai/hooks/use-follow-up-assistant-runtime";
import type {
	ImproveQuestionsAgentStatus,
	ImproveQuestionsUIMessage,
} from "./types";

interface AgentStreamPanelProps {
	messages: ImproveQuestionsUIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveQuestionsAgentStatus;
	composerEnabled?: boolean;
	onSendFollowUp?: (message: string) => void;
}

export function AgentStreamPanel({
	messages,
	isStreaming,
	agentStatus,
	composerEnabled = false,
	onSendFollowUp,
}: AgentStreamPanelProps) {
	const visibleMessages = messages.filter((message) => message.parts.length > 0);
	const runtime = useFollowUpAssistantRuntime({
		messages: visibleMessages,
		isRunning: isStreaming,
		composerEnabled,
		onSend: onSendFollowUp,
	});

	if (visibleMessages.length === 0) {
		const waiting =
			agentStatus === "running" || isStreaming ? (
				<span className="inline-flex items-center gap-2">
					<Loader2 className="size-4 animate-spin" />
					Waiting for agent output...
				</span>
			) : agentStatus === "idle" ? (
				"Waiting to start…"
			) : (
				"No messages yet."
			);

		return (
			<div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
				{waiting}
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-muted">
			<StudyAssistantRuntimeProvider runtime={runtime}>
				<Thread showComposer={composerEnabled} collapsiblePrompts />
			</StudyAssistantRuntimeProvider>
		</div>
	);
}
