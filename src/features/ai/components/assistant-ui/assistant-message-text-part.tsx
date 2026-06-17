import { useAuiState } from "@assistant-ui/react";
import { MarkdownText } from "@/features/ai/components/assistant-ui/markdown-text";
import { ThinkingIndicator } from "@/features/ai/components/assistant-ui/thinking-indicator";

export function AssistantMessageTextPart() {
	const isEmptyWhileRunning = useAuiState((state) => {
		if (state.part.type !== "text") return false;
		if (state.part.status?.type !== "running") return false;
		return state.part.text.trim().length === 0;
	});

	if (isEmptyWhileRunning) {
		return <ThinkingIndicator className="py-0.5" />;
	}

	return <MarkdownText />;
}
