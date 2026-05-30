import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import { useEffect, useRef, useState } from "react";
import {
	chatStore,
	setError,
	setIsLoading,
	setMessages,
} from "@/stores/chatStore";
import {
	ensureActiveConversation,
	getConversationMessages,
	saveMessagesToConversation,
} from "@/stores/conversationsStore";
import {
	estimateTokens,
	getMessageText,
	type PerfRuntime,
	WELCOME,
} from "../chat-utils";
import type { AssistantPerfMetrics } from "../message/chat-message";

export function useChatClient(activeId: string | null) {
	const [chatClient, setChatClient] = useState<ChatClient | null>(null);
	const [assistantMetrics, setAssistantMetrics] = useState<
		Record<string, AssistantPerfMetrics>
	>({});
	const perfRuntimeRef = useRef<Record<string, PerfRuntime>>({});
	const pendingSendStartedAtRef = useRef<number | null>(null);
	const lastTokenUsageRef = useRef<{
		promptTokens: number;
		completionTokens: number;
	} | null>(null);
	const lastAssistantIdRef = useRef<string | null>(null);
	const activeIdRef = useRef(activeId);
	activeIdRef.current = activeId;

	useEffect(() => {
		if (!activeId) {
			ensureActiveConversation();
			return;
		}
		setAssistantMetrics({});
		perfRuntimeRef.current = {};
		pendingSendStartedAtRef.current = null;
		lastTokenUsageRef.current = null;
		lastAssistantIdRef.current = null;

		const initialMessages = getConversationMessages(activeId);
		const client = new ChatClient({
			initialMessages: initialMessages.length > 0 ? initialMessages : [WELCOME],
			connection: fetchServerSentEvents("/api/chat"),
			onChunk: (chunk) => {
				const c = chunk as {
					usage?: {
						promptTokens: number;
						completionTokens: number;
						totalTokens: number;
					};
				};
				if (c.usage) {
					lastTokenUsageRef.current = {
						promptTokens: c.usage.promptTokens,
						completionTokens: c.usage.completionTokens,
					};
				}
			},
			onMessagesChange: (msgs) => {
				if (activeIdRef.current !== activeId) return;
				const now = Date.now();
				const assistantMessages = msgs.filter(
					(msg) => msg.role === "assistant" && msg.id !== "welcome",
				);
				const latestAssistant = assistantMessages[assistantMessages.length - 1];

				if (latestAssistant) {
					lastAssistantIdRef.current = latestAssistant.id;
					let runtime = perfRuntimeRef.current[latestAssistant.id];
					if (!runtime) {
						runtime = {
							startedAt: pendingSendStartedAtRef.current ?? now,
							firstTokenAt: null,
						};
						perfRuntimeRef.current[latestAssistant.id] = runtime;
					}

					const text = getMessageText(latestAssistant);
					if (text.length > 0 && runtime.firstTokenAt === null) {
						runtime.firstTokenAt = now;
					}

					if (runtime.firstTokenAt !== null) {
						const elapsedSeconds = Math.max(
							0.001,
							(now - runtime.firstTokenAt) / 1000,
						);
						const tokenCount = estimateTokens(text);
						const nextMetrics: AssistantPerfMetrics = {
							ttftMs: Math.max(0, runtime.firstTokenAt - runtime.startedAt),
							tokensPerSecond: tokenCount / elapsedSeconds,
							isStreaming: true,
						};
						setAssistantMetrics((prev) => ({
							...prev,
							[latestAssistant.id]: nextMetrics,
						}));
					}
				}
				setMessages([...msgs]);
				saveMessagesToConversation(activeId, msgs);
			},
			onLoadingChange: (loading) => {
				if (activeIdRef.current === activeId) setIsLoading(loading);
				if (!loading) {
					pendingSendStartedAtRef.current = null;
					const usage = lastTokenUsageRef.current;
					const lastId = lastAssistantIdRef.current;
					lastTokenUsageRef.current = null;
					setAssistantMetrics((prev) => {
						const next = { ...prev };
						for (const [id, metrics] of Object.entries(next)) {
							const updated: AssistantPerfMetrics = {
								...metrics,
								isStreaming: false,
							};
							if (id === lastId && usage) {
								updated.inputTokens = usage.promptTokens;
								updated.outputTokens = usage.completionTokens;
							}
							next[id] = updated;
						}
						return next;
					});
				}
			},
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

	return { chatClient, assistantMetrics, pendingSendStartedAtRef };
}
