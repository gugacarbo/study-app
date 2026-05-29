import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
	chatStore,
	setError,
	setInput,
	setIsLoading,
	setMessages,
} from "@/stores/chatStore";
import {
	conversationsStore,
	ensureActiveConversation,
	getConversationMessages,
	saveMessagesToConversation,
	updateConversationTitle,
} from "@/stores/conversationsStore";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { type AssistantPerfMetrics, ChatMessage } from "./chat-message";
import { ChatSidebar } from "./chat-sidebar";

const WELCOME = {
	id: "welcome",
	role: "assistant" as const,
	parts: [
		{
			type: "text" as const,
			content:
				"Hi! I'm your study assistant. Ask me anything about your subjects.",
		},
	],
};

interface PerfRuntime {
	startedAt: number;
	firstTokenAt: number | null;
}

function getMessageText(message: {
	parts: Array<{ type: string; content?: string }>;
}): string {
	return message.parts
		.filter((part) => part.type === "text" || part.type === "thinking")
		.map((part) => part.content ?? "")
		.join("");
}

function estimateTokens(text: string): number {
	const clean = text.trim();
	if (!clean) return 0;
	return Math.max(1, Math.round(clean.length / 4));
}

export function Chat() {
	const messages = useSelector(chatStore, (s) => s.messages);
	const isLoading = useSelector(chatStore, (s) => s.isLoading);
	const error = useSelector(chatStore, (s) => s.error);
	const input = useSelector(chatStore, (s) => s.input);
	const activeId = useSelector(conversationsStore, (s) => s.activeId);
	const conversations = useSelector(conversationsStore, (s) => s.conversations);

	const bottomRef = useRef<HTMLDivElement>(null);
	const activeIdRef = useRef(activeId);
	activeIdRef.current = activeId;
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [chatClient, setChatClient] = useState<ChatClient | null>(null);
	const [assistantMetrics, setAssistantMetrics] = useState<
		Record<string, AssistantPerfMetrics>
	>({});
	const perfRuntimeRef = useRef<Record<string, PerfRuntime>>({});
	const pendingSendStartedAtRef = useRef<number | null>(null);

	useEffect(() => {
		if (!activeId) ensureActiveConversation();
	}, [activeId]);

	useEffect(() => {
		if (!activeId) return;
		setAssistantMetrics({});
		perfRuntimeRef.current = {};
		pendingSendStartedAtRef.current = null;

		const initialMessages = getConversationMessages(activeId);
		const client = new ChatClient({
			initialMessages: initialMessages.length > 0 ? initialMessages : [WELCOME],
			connection: fetchServerSentEvents("/api/chat"),
			onMessagesChange: (msgs) => {
				if (activeIdRef.current !== activeId) return;
				const now = Date.now();
				const assistantMessages = msgs.filter(
					(msg) => msg.role === "assistant" && msg.id !== "welcome",
				);
				const latestAssistant = assistantMessages[assistantMessages.length - 1];

				if (latestAssistant) {
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
					setAssistantMetrics((prev) => {
						const next = { ...prev };
						for (const [id, metrics] of Object.entries(next)) {
							next[id] = { ...metrics, isStreaming: false };
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

	useEffect(() => {
		if (!activeId) return;
		const conv = conversations.find((c) => c.id === activeId);
		if (conv?.title !== "New Chat") return;
		const text =
			messages
				.find((m) => m.role === "user")
				?.parts.find((p) => p.type === "text")?.content ?? "";
		if (text)
			updateConversationTitle(
				activeId,
				text.length > 50 ? `${text.slice(0, 47)}...` : text,
			);
	}, [messages, activeId, conversations]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	async function handleSend() {
		const text = input.trim();
		if (!text || isLoading || !chatClient) return;
		pendingSendStartedAtRef.current = Date.now();
		setInput("");
		await chatClient.sendMessage(text);
	}

	function handleStartEdit() {
		const c = conversations.find((c2) => c2.id === activeId);
		setTitleDraft(c?.title ?? "");
		setEditingTitle(true);
	}

	function handleSaveTitle() {
		if (activeId && titleDraft.trim())
			updateConversationTitle(activeId, titleDraft.trim());
		setEditingTitle(false);
	}

	return (
		<div data-fullwidth className="h-[calc(100dvh-4rem)] overflow-hidden">
			<div className="mx-auto flex h-full w-full max-w-5xl overflow-hidden px-4 py-4 md:px-6">
				<ChatSidebar />
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<ChatHeader
							activeId={activeId}
							conversations={conversations}
							editingTitle={editingTitle}
							titleDraft={titleDraft}
							onStartEditing={handleStartEdit}
							onSaveTitle={handleSaveTitle}
							onCancelEditing={() => setEditingTitle(false)}
							onTitleDraftChange={setTitleDraft}
						/>
						<CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto py-0">
							{messages.map((msg) => (
								<ChatMessage
									key={msg.id}
									message={msg}
									metrics={assistantMetrics[msg.id]}
								/>
							))}

							{isLoading && (
								<div className="flex justify-start">
									<div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
										Thinking...
									</div>
								</div>
							)}

							{error && (
								<div className="flex justify-center">
									<div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
										{error.message}
									</div>
								</div>
							)}

							<div ref={bottomRef} />
						</CardContent>

						<ChatInput
							input={input}
							onInputChange={setInput}
							onSend={handleSend}
							isLoading={isLoading}
						/>
					</Card>
				</div>
			</div>
		</div>
	);
}
