import type { UIMessage } from "@tanstack/ai-client";
import {
	estimateTokens,
	getMessageText,
	type PerfRuntime,
} from "@/features/ai/components/chat/chat-utils";
import type { AssistantPerfMetrics } from "@/features/ai/types/assistant-perf-metrics";
import { setMessages } from "@/features/ai/stores/chat-store";
import { saveMessagesToConversation } from "@/features/ai/stores/conversations-store";

interface MessageChangeRefs {
	activeIdRef: React.MutableRefObject<string | null>;
	perfRuntimeRef: React.MutableRefObject<Record<string, PerfRuntime>>;
	lastAssistantTextRef: React.MutableRefObject<Record<string, string>>;
	pendingSendStartedAtRef: React.MutableRefObject<number | null>;
	lastAssistantIdRef: React.MutableRefObject<string | null>;
}

export function createOnMessagesChange(
	activeId: string,
	refs: MessageChangeRefs,
	setAssistantMetrics: React.Dispatch<
		React.SetStateAction<Record<string, AssistantPerfMetrics>>
	>,
) {
	return (msgs: UIMessage[]) => {
		if (refs.activeIdRef.current !== activeId) return;
		const now = Date.now();
		const assistantMessages = msgs.filter(
			(msg) => msg.role === "assistant" && msg.id !== "welcome",
		);
		const latestAssistant = assistantMessages[assistantMessages.length - 1];

		if (latestAssistant) {
			refs.lastAssistantIdRef.current = latestAssistant.id;
			let runtime = refs.perfRuntimeRef.current[latestAssistant.id];
			if (!runtime) {
				runtime = {
					startedAt: refs.pendingSendStartedAtRef.current ?? now,
					firstTokenAt: null,
				};
				refs.perfRuntimeRef.current[latestAssistant.id] = runtime;
			}

			const text = getMessageText(latestAssistant);
			const prevText =
				refs.lastAssistantTextRef.current[latestAssistant.id] ?? "";
			const hasNewContent = text.length > prevText.length;
			if (hasNewContent) {
				refs.lastAssistantTextRef.current[latestAssistant.id] = text;
			}
			if (text.length > 0 && runtime.firstTokenAt === null) {
				runtime.firstTokenAt = now;
			}
			if (runtime.firstTokenAt !== null && hasNewContent) {
				const firstTokenAt = runtime.firstTokenAt;
				const elapsedSec = Math.max(0.001, (now - firstTokenAt) / 1000);
				setAssistantMetrics((prev) => {
					const existing = prev[latestAssistant.id];
					return {
						...prev,
						[latestAssistant.id]: {
							ttftMs: Math.max(0, firstTokenAt - runtime.startedAt),
							tokensPerSecond: estimateTokens(text) / elapsedSec,
							isStreaming: true,
							inputTokens: existing?.inputTokens,
							outputTokens: existing?.outputTokens,
						},
					};
				});
			}
		}
		setMessages([...msgs]);
		saveMessagesToConversation(activeId, msgs);
	};
}
