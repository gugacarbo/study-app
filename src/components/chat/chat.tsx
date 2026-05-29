import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { ChatSidebar } from "./chat-sidebar";
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
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatHeader } from "./chat-header";

const WELCOME = {
	id: "welcome",
	role: "assistant" as const,
	parts: [{ type: "text" as const, content: "Hi! I'm your study assistant. Ask me anything about your subjects." }],
};

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

	useEffect(() => {
		if (!activeId) ensureActiveConversation();
	}, []);

	useEffect(() => {
		if (!activeId) return;

		const initialMessages = getConversationMessages(activeId);
		const client = new ChatClient({
			initialMessages: initialMessages.length > 0 ? initialMessages : [WELCOME],
			connection: fetchServerSentEvents("/api/chat"),
			onMessagesChange: (msgs) => {
				if (activeIdRef.current !== activeId) return;
				setMessages([...msgs]);
				saveMessagesToConversation(activeId, msgs);
			},
			onLoadingChange: (loading) => {
				if (activeIdRef.current === activeId) setIsLoading(loading);
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
		const text = messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.content ?? "";
		if (text) updateConversationTitle(activeId, text.length > 50 ? `${text.slice(0, 47)}...` : text);
	}, [messages, activeId, conversations]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	async function handleSend() {
		const text = input.trim();
		if (!text || isLoading || !chatClient) return;
		setInput("");
		await chatClient.sendMessage(text);
	}

	function handleStartEdit() {
		const c = conversations.find((c2) => c2.id === activeId);
		setTitleDraft(c?.title ?? "");
		setEditingTitle(true);
	}

	function handleSaveTitle() {
		if (activeId && titleDraft.trim()) updateConversationTitle(activeId, titleDraft.trim());
		setEditingTitle(false);
	}

	return (
		<div data-fullwidth className="flex h-[calc(100vh-4rem)] max-w-7xl mx-auto">
			<ChatSidebar />
			<div className="flex-1 flex flex-col min-w-0">
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

				<Card className="flex flex-col flex-1">
					<CardContent className="flex-1 overflow-y-auto space-y-4">
						{messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}

						{isLoading && (
							<div className="flex justify-start">
								<div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">Thinking...</div>
							</div>
						)}

						{error && (
							<div className="flex justify-center">
								<div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error.message}</div>
							</div>
						)}

						<div ref={bottomRef} />
					</CardContent>

					<ChatInput input={input} onInputChange={setInput} onSend={handleSend} isLoading={isLoading} />
				</Card>
			</div>
		</div>
	);
}
