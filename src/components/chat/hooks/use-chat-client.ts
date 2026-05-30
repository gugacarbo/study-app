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

interface ChatUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function parseUsageFromChunk(chunk: unknown): ChatUsage | null {
	if (!chunk || typeof chunk !== "object") return null;
	const raw = (chunk as Record<string, unknown>).usage;
	if (!raw || typeof raw !== "object") return null;
	const usage = raw as Record<string, unknown>;

	const promptTokens =
		toNumber(usage.promptTokens) ?? toNumber(usage.inputTokens);
	const completionTokens =
		toNumber(usage.completionTokens) ?? toNumber(usage.outputTokens);
	const totalTokens =
		toNumber(usage.totalTokens) ??
		toNumber(usage.total_tokens) ??
		(promptTokens != null && completionTokens != null
			? promptTokens + completionTokens
			: null);

	if (promptTokens == null || completionTokens == null || totalTokens == null) {
		return null;
	}

	return { promptTokens, completionTokens, totalTokens };
}

function estimateUsageFromMessages(
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

export function useChatClient(activeId: string | null) {
	const [chatClient, setChatClient] = useState<ChatClient | null>(null);
	const [assistantMetrics, setAssistantMetrics] = useState<
		Record<string, AssistantPerfMetrics>
	>({});
	const [chatTokenTotals, setChatTokenTotals] = useState<{
		inputTokens: number;
		outputTokens: number;
		contextTokens: number;
	}>({
		inputTokens: 0,
		outputTokens: 0,
		contextTokens: 0,
	});
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
		setAssistantMetrics({});
		perfRuntimeRef.current = {};
		lastAssistantTextRef.current = {};
		pendingSendStartedAtRef.current = null;
		lastTokenUsageRef.current = null;
		usageCommittedRef.current = false;
		lastAssistantIdRef.current = null;
		setChatTokenTotals({
			inputTokens: 0,
			outputTokens: 0,
			contextTokens: 0,
		});

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
					const previousText =
						lastAssistantTextRef.current[latestAssistant.id] ?? "";
					const hasNewContent = text.length > previousText.length;
					if (hasNewContent) {
						lastAssistantTextRef.current[latestAssistant.id] = text;
					}

					if (text.length > 0 && runtime.firstTokenAt === null) {
						runtime.firstTokenAt = now;
					}

					if (runtime.firstTokenAt !== null && hasNewContent) {
						const firstTokenAt = runtime.firstTokenAt;
						const elapsedSeconds = Math.max(0.001, (now - firstTokenAt) / 1000);
						const tokenCount = estimateTokens(text);
						setAssistantMetrics((prev) => {
							const existing = prev[latestAssistant.id];
							const nextMetrics: AssistantPerfMetrics = {
								ttftMs: Math.max(0, firstTokenAt - runtime.startedAt),
								tokensPerSecond: tokenCount / elapsedSeconds,
								isStreaming: true,
								inputTokens: existing?.inputTokens,
								outputTokens: existing?.outputTokens,
							};
							return {
								...prev,
								[latestAssistant.id]: nextMetrics,
							};
						});
					}
				}
				setMessages([...msgs]);
				saveMessagesToConversation(activeId, msgs);
			},
			onLoadingChange: (loading) => {
				if (activeIdRef.current === activeId) setIsLoading(loading);
				if (loading) {
					usageCommittedRef.current = false;
					return;
				}

				if (!loading) {
					pendingSendStartedAtRef.current = null;
					const usage =
						lastTokenUsageRef.current ??
						estimateUsageFromMessages(lastAssistantIdRef.current);
					const lastId = lastAssistantIdRef.current;
					if (usage && !usageCommittedRef.current) {
						setChatTokenTotals((prev) => ({
							inputTokens: prev.inputTokens + usage.promptTokens,
							outputTokens: prev.outputTokens + usage.completionTokens,
							contextTokens: prev.contextTokens + usage.promptTokens,
						}));
						usageCommittedRef.current = true;
					}
					setAssistantMetrics((prev) => {
						const next: Record<string, AssistantPerfMetrics> = {};
						for (const [id, metrics] of Object.entries(prev)) {
							next[id] = { ...metrics, isStreaming: false };
						}
						if (lastId) {
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
							};
						}
						return next;
					});
					lastTokenUsageRef.current = null;
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

	return {
		chatClient,
		assistantMetrics,
		pendingSendStartedAtRef,
		chatTokenTotals,
	};
}
