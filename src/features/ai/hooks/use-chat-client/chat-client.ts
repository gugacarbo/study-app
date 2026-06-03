import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import { useEffect, useRef, useState } from "react";
import {
	type PerfRuntime,
	WELCOME,
} from "@/features/ai/components/chat/chat-utils";
import type { AssistantPerfMetrics } from "@/features/ai/components/chat/message/chat-message";
import {
	chatStore,
	setError,
	setIsLoading,
	setMessages,
} from "@/features/ai/stores/chat-store";
import {
	ensureActiveConversation,
	getAssistantMetrics,
	getConversationMessages,
	getTokenTotals,
	saveAssistantMetrics,
	saveMessagesToConversation,
	saveTokenTotals,
} from "@/features/ai/stores/conversations-store";
import { createOnLoadingChange } from "./callbacks";
import { createOnMessagesChange } from "./message-callbacks";
import type { ChatUsage } from "./types";
import { parseUsageFromChunk } from "./types";

export function useChatClient(activeId: string | null) {
	const [chatClient, setChatClient] = useState<ChatClient | null>(null);
	const [assistantMetrics, setAssistantMetrics] = useState<
		Record<string, AssistantPerfMetrics>
	>({});
	const [chatTokenTotals, setChatTokenTotals] = useState<{
		inputTokens: number;
		outputTokens: number;
		contextTokens: number;
	}>({ inputTokens: 0, outputTokens: 0, contextTokens: 0 });
	const perfRuntimeRef = useRef<Record<string, PerfRuntime>>({});
	const lastAssistantTextRef = useRef<Record<string, string>>({});
	const pendingSendStartedAtRef = useRef<number | null>(null);
	const lastTokenUsageRef = useRef<ChatUsage | null>(null);
	const usageCommittedRef = useRef(false);
	const lastAssistantIdRef = useRef<string | null>(null);
	const activeIdRef = useRef(activeId);
	activeIdRef.current = activeId;

	useEffect(() => {
		if (!activeId) {
			ensureActiveConversation();
			return;
		}
		setAssistantMetrics(getAssistantMetrics(activeId));
		setChatTokenTotals(getTokenTotals(activeId));
		perfRuntimeRef.current = {};
		lastAssistantTextRef.current = {};
		pendingSendStartedAtRef.current = null;
		lastTokenUsageRef.current = null;
		usageCommittedRef.current = false;
		lastAssistantIdRef.current = null;

		const refs = {
			activeIdRef,
			perfRuntimeRef,
			lastAssistantTextRef,
			pendingSendStartedAtRef,
			lastTokenUsageRef,
			usageCommittedRef,
			lastAssistantIdRef,
		};
		const setters = { setIsLoading, setChatTokenTotals, setAssistantMetrics };

		const initialMessages = getConversationMessages(activeId);
		const client = new ChatClient({
			initialMessages: initialMessages.length > 0 ? initialMessages : [WELCOME],
			connection: fetchServerSentEvents("/api/chat"),
			onChunk: (chunk) => {
				const usage = parseUsageFromChunk(chunk);
				if (usage) {
					lastTokenUsageRef.current = usage;
					usageCommittedRef.current = false;
				}
			},
			onMessagesChange: createOnMessagesChange(
				activeId,
				refs,
				setAssistantMetrics,
			),
			onLoadingChange: createOnLoadingChange(activeId, refs, setters),
			onErrorChange: (err) => {
				if (activeIdRef.current === activeId) setError(err);
			},
		});

		setChatClient(client);
		setMessages(client.getMessages());
		setIsLoading(client.getIsLoading());
		setError(client.getError());

		return () => saveMessagesToConversation(activeId, chatStore.state.messages);
	}, [activeId]);

	useEffect(() => {
		if (activeId) saveAssistantMetrics(activeId, assistantMetrics);
	}, [assistantMetrics, activeId]);

	useEffect(() => {
		if (activeId) saveTokenTotals(activeId, chatTokenTotals);
	}, [chatTokenTotals, activeId]);

	return {
		chatClient,
		assistantMetrics,
		pendingSendStartedAtRef,
		chatTokenTotals,
	};
}
