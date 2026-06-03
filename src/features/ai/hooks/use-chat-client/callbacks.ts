import {
	estimateTokens,
	getMessageText,
	type PerfRuntime,
} from "@/features/ai/components/chat/chat-utils";
import type { AssistantPerfMetrics } from "@/features/ai/components/chat/message/chat-message";
import { chatStore } from "@/features/ai/stores/chat-store";
import type { ChatUsage } from "./types";

export function estimateUsageFromMessages(
	lastAssistantId: string | null,
): ChatUsage | null {
	if (!lastAssistantId) return null;
	const messages = chatStore.state.messages;
	const assistantIndex = messages.findIndex(
		(msg) => msg.id === lastAssistantId,
	);
	if (assistantIndex === -1) return null;

	const assistantMessage = messages[assistantIndex];
	const completionTokens = estimateTokens(getMessageText(assistantMessage));

	let promptTokens = 0;
	for (let i = assistantIndex - 1; i >= 0; i -= 1) {
		const candidate = messages[i];
		if (candidate.role === "user") {
			promptTokens = estimateTokens(getMessageText(candidate));
			break;
		}
	}

	if (completionTokens <= 0 && promptTokens <= 0) return null;
	const safePrompt = Math.max(1, promptTokens);
	const safeCompletion = Math.max(1, completionTokens);
	return {
		promptTokens: safePrompt,
		completionTokens: safeCompletion,
		totalTokens: safePrompt + safeCompletion,
	};
}

interface CallbackRefs {
	activeIdRef: React.MutableRefObject<string | null>;
	perfRuntimeRef: React.MutableRefObject<Record<string, PerfRuntime>>;
	lastAssistantTextRef: React.MutableRefObject<Record<string, string>>;
	pendingSendStartedAtRef: React.MutableRefObject<number | null>;
	lastTokenUsageRef: React.MutableRefObject<ChatUsage | null>;
	usageCommittedRef: React.MutableRefObject<boolean>;
	lastAssistantIdRef: React.MutableRefObject<string | null>;
}

interface CallbackSetters {
	setIsLoading: (loading: boolean) => void;
	setChatTokenTotals: React.Dispatch<
		React.SetStateAction<{
			inputTokens: number;
			outputTokens: number;
			contextTokens: number;
		}>
	>;
	setAssistantMetrics: React.Dispatch<
		React.SetStateAction<Record<string, AssistantPerfMetrics>>
	>;
}

export function createOnLoadingChange(
	activeId: string,
	refs: CallbackRefs,
	setters: CallbackSetters,
) {
	return (loading: boolean) => {
		if (refs.activeIdRef.current === activeId) setters.setIsLoading(loading);
		if (loading) {
			refs.usageCommittedRef.current = false;
			return;
		}
		refs.pendingSendStartedAtRef.current = null;
		const usage =
			refs.lastTokenUsageRef.current ??
			estimateUsageFromMessages(refs.lastAssistantIdRef.current);
		const lastId = refs.lastAssistantIdRef.current;
		if (usage && !refs.usageCommittedRef.current) {
			setters.setChatTokenTotals((prev) => ({
				inputTokens: prev.inputTokens + usage.promptTokens,
				outputTokens: prev.outputTokens + usage.completionTokens,
				contextTokens: prev.contextTokens + usage.promptTokens,
			}));
			refs.usageCommittedRef.current = true;
		}
		setters.setAssistantMetrics((prev) => {
			const now = Date.now();
			const next: Record<string, AssistantPerfMetrics> = {};
			for (const [id, metrics] of Object.entries(prev)) {
				next[id] = { ...metrics, isStreaming: false };
			}
			if (lastId) {
				const runtime = refs.perfRuntimeRef.current[lastId];
				const existing = next[lastId] ?? {
					ttftMs: 0,
					tokensPerSecond: 0,
					isStreaming: false,
				};
				next[lastId] = {
					...existing,
					isStreaming: false,
					inputTokens: usage?.promptTokens ?? existing.inputTokens,
					outputTokens: usage?.completionTokens ?? existing.outputTokens,
					respondedAt: usage ? now : existing.respondedAt,
					totalResponseMs:
						usage && runtime?.startedAt
							? now - runtime.startedAt
							: existing.totalResponseMs,
				};
			}
			return next;
		});
		refs.lastTokenUsageRef.current = null;
	};
}
