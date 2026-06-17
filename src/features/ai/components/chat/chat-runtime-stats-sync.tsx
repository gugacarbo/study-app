import { useAuiState } from "@assistant-ui/react";
import { useThreadTokenUsage } from "@assistant-ui/react-ai-sdk";
import { useEffect } from "react";
import type { AiModelPublic } from "@/db/queries/types";
import { aggregateThreadTokenUsage } from "@/features/ai/lib/aggregate-thread-token-usage";
import { estimateThreadTextLength } from "@/features/ai/lib/estimate-thread-text-length";
import {
	clearChatRuntimeStats,
	setChatRuntimeStats,
} from "@/features/ai/stores/chat-runtime-stats-store";

interface ChatRuntimeStatsSyncProps {
	conversationId: string;
	selectedModel?: AiModelPublic;
}

export function ChatRuntimeStatsSync({
	conversationId,
	selectedModel,
}: ChatRuntimeStatsSyncProps) {
	const tokenUsage = useThreadTokenUsage();
	const threadMessages = useAuiState((state) => state.thread.messages);
	const runtimeMessageCount = threadMessages.length;
	const contextCharacterCount = estimateThreadTextLength(threadMessages);
	const sessionUsage = aggregateThreadTokenUsage(threadMessages);
	const lastInputTokens = tokenUsage?.inputTokens ?? null;
	const lastOutputTokens = tokenUsage?.outputTokens ?? null;

	useEffect(() => {
		setChatRuntimeStats({
			conversationId,
			runtimeMessageCount,
			contextCharacterCount,
			inputTokens: lastInputTokens,
			outputTokens: lastOutputTokens,
			contextTokens: lastInputTokens,
			reasoningTokens: tokenUsage?.reasoningTokens ?? null,
			cachedInputTokens: tokenUsage?.cachedInputTokens ?? null,
			totalTokens: tokenUsage?.totalTokens ?? null,
			sessionInputTokens: sessionUsage?.inputTokens ?? null,
			sessionOutputTokens: sessionUsage?.outputTokens ?? null,
			sessionTotalTokens: sessionUsage?.totalTokens ?? null,
			modelDisplayName: selectedModel?.displayName ?? null,
			contextWindow: selectedModel?.contextWindow ?? null,
			maxOutputTokens: selectedModel?.maxOutputTokens ?? null,
		});
	}, [
		conversationId,
		runtimeMessageCount,
		contextCharacterCount,
		lastInputTokens,
		lastOutputTokens,
		tokenUsage?.reasoningTokens,
		tokenUsage?.cachedInputTokens,
		tokenUsage?.totalTokens,
		sessionUsage?.inputTokens,
		sessionUsage?.outputTokens,
		sessionUsage?.totalTokens,
		selectedModel?.displayName,
		selectedModel?.contextWindow,
		selectedModel?.maxOutputTokens,
	]);

	useEffect(() => {
		return () => clearChatRuntimeStats(conversationId);
	}, [conversationId]);

	return null;
}
