import { ChatClient, fetchServerSentEvents } from "@tanstack/ai-client";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { ChatSidebar } from "#/components/chat-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const WELCOME_MESSAGE = {
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

	// Ensure there's an active conversation on mount
	useEffect(() => {
		if (!activeId) {
			ensureActiveConversation();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Create/switch ChatClient when activeId changes
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [chatClient, setChatClient] = useState<ChatClient | null>(null);

	useEffect(() => {
		if (!activeId) return;

		const savedMessages = getConversationMessages(activeId);
		const initialMessages =
			savedMessages.length > 0 ? savedMessages : [WELCOME_MESSAGE];

		const client = new ChatClient({
			initialMessages,
			connection: fetchServerSentEvents("/api/chat"),
			onMessagesChange: (msgs) => {
				if (activeIdRef.current === activeId) {
					setMessages([...msgs]);
				}
			},
			onLoadingChange: (loading) => {
				if (activeIdRef.current === activeId) {
					setIsLoading(loading);
				}
			},
			onErrorChange: (err) => {
				if (activeIdRef.current === activeId) {
					setError(err);
				}
			},
		});

		setChatClient(client);

		// Sync initial state
		setMessages(client.getMessages());
		setIsLoading(client.getIsLoading());
		setError(client.getError());

		return () => {
			// Save current messages when switching away
			const currentMessages = chatStore.state.messages;
			saveMessagesToConversation(activeId, currentMessages);
		};
	}, [activeId]);

	// Persist messages to conversationsStore on every change
	useEffect(() => {
		if (!activeId) return;
		const unsub = chatStore.subscribe(() => {
			saveMessagesToConversation(activeId, chatStore.state.messages);
		});
		return () => unsub.unsubscribe();
	}, [activeId]);

	// Auto-title from first user message
	useEffect(() => {
		if (!activeId) return;
		const conv = conversations.find((c) => c.id === activeId);
		if (conv?.title === "New Chat") {
			const firstUserMsg = messages.find((m) => m.role === "user");
			if (firstUserMsg) {
				const text =
					firstUserMsg.parts.find((p) => p.type === "text")?.content ?? "";
				if (text) {
					const title = text.length > 50 ? text.slice(0, 47) + "..." : text;
					updateConversationTitle(activeId, title);
				}
			}
		}
	}, [messages, activeId, conversations]);

	// Auto-scroll
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	async function handleSend() {
		const text = input.trim();
		if (!text || isLoading || !chatClient) return;

		setInput("");
		await chatClient.sendMessage(text);
	}

	function startEditing() {
		const conv = conversations.find((c) => c.id === activeId);
		setTitleDraft(conv?.title ?? "");
		setEditingTitle(true);
	}

	function saveTitle() {
		if (activeId && titleDraft.trim()) {
			updateConversationTitle(activeId, titleDraft.trim());
		}
		setEditingTitle(false);
	}

	function cancelEditing() {
		setEditingTitle(false);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function parseTextParts(
		content: string,
	): Array<
		{ type: "text"; content: string } | { type: "think"; content: string }
	> {
		const parts: Array<
			{ type: "text"; content: string } | { type: "think"; content: string }
		> = [];

		const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
		let lastIndex = 0;
		let match: RegExpExecArray | null = null;

		while ((match = thinkRegex.exec(content)) !== null) {
			if (match.index > lastIndex) {
				const text = content.slice(lastIndex, match.index).trim();
				if (text) {
					parts.push({ type: "text", content: text });
				}
			}

			const thinkContent = (match[1] || "").trim();
			if (thinkContent) {
				parts.push({ type: "think", content: thinkContent });
			}

			lastIndex = thinkRegex.lastIndex;
		}

		if (lastIndex < content.length) {
			const tail = content.slice(lastIndex).trim();
			if (tail) {
				parts.push({ type: "text", content: tail });
			}
		}

		return parts.length > 0 ? parts : [{ type: "text", content }];
	}

	return (
		<div data-fullwidth className="flex h-[calc(100vh-4rem)] max-w-7xl mx-auto">
			<ChatSidebar />
			<div className="flex-1 flex flex-col min-w-0">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="text-2xl font-bold">Chat</h1>
					{activeId && conversations.length > 0 && (
						editingTitle ? (
							<Input
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onBlur={saveTitle}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										saveTitle();
									}
									if (e.key === "Escape") {
										cancelEditing();
									}
								}}
								autoFocus
								className="h-7 w-64 text-sm"
							/>
						) : (
							<button
								type="button"
								onClick={startEditing}
								className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-text"
							>
								{conversations.find((c) => c.id === activeId)?.title ?? "Chat"}
							</button>
						)
					)}
				</div>

				<Card className="flex flex-col flex-1">
					<CardContent className="flex-1 overflow-y-auto space-y-4">
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex ${
									msg.role === "user" ? "justify-end" : "justify-start"
								}`}
							>
								<div
									className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
										msg.role === "user"
											? "bg-primary text-primary-foreground"
											: "bg-card border border-border text-card-foreground"
									}`}
								>
									{msg.parts.map((part, i) =>
										part.type === "text" ? (
											<div key={i} className="space-y-2">
												{parseTextParts(part.content).map(
													(parsedPart, parsedIdx) =>
														parsedPart.type === "text" ? (
															<p key={`${i}-text-${parsedIdx}`}>
																{parsedPart.content}
															</p>
														) : (
															<details
																key={`${i}-think-${parsedIdx}`}
																className="rounded-md border border-border/60 bg-muted/40"
															>
																<summary className="list-none cursor-pointer select-none rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
																	Raciocínio do modelo
																</summary>
																<p className="px-2 pb-2 whitespace-pre-wrap text-xs text-muted-foreground">
																	{parsedPart.content}
																</p>
															</details>
														),
												)}
											</div>
										) : part.type === "thinking" ? (
											<span key={i} className="italic text-muted-foreground">
												{part.content}
											</span>
										) : null,
									)}
								</div>
							</div>
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

					<CardFooter className="border-t border-border gap-3 pt-4 pb-3">
						<Textarea
							className="min-h-[5rem] max-h-48 flex-1"
							rows={3}
							placeholder="Ask a question..."
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
						<Button
							size="lg"
							className="shrink-0 self-end px-4"
							onClick={handleSend}
							disabled={!input.trim() || isLoading}
						>
							Send
						</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
