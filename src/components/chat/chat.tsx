import { useSelector } from "@tanstack/react-store";
import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { chatStore, setInput } from "@/stores/chatStore";
import {
	conversationsStore,
	updateConversationTitle,
} from "@/stores/conversationsStore";
import { useAutoScroll } from "./use-auto-scroll";
import { useAutoTitle } from "./use-auto-title";
import { useChatClient } from "./use-chat-client";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { ChatSidebar } from "./chat-sidebar";
import { ChatLoading } from "./chat-loading";
import { ChatError } from "./chat-error";

export function Chat() {
	const messages = useSelector(chatStore, (s) => s.messages);
	const isLoading = useSelector(chatStore, (s) => s.isLoading);
	const error = useSelector(chatStore, (s) => s.error);
	const input = useSelector(chatStore, (s) => s.input);
	const activeId = useSelector(conversationsStore, (s) => s.activeId);
	const conversations = useSelector(conversationsStore, (s) => s.conversations);

	const bottomRef = useRef<HTMLDivElement>(null);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");

	useAutoScroll(bottomRef);
	useAutoTitle(activeId, messages, conversations);
	const { chatClient, assistantMetrics, pendingSendStartedAtRef } =
		useChatClient(activeId);

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
							{isLoading && <ChatLoading />}
							{error && <ChatError error={error} />}
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
