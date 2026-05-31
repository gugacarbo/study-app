import { useSelector } from "@tanstack/react-store";
import { useRef, useState } from "react";
import { CardContent } from "@/components/ui/card";
import { chatStore, setInput } from "@/features/ai/stores/chat-store";
import {
	conversationsStore,
	updateConversationTitle,
} from "@/features/ai/stores/conversations-store";
import { ChatError } from "./chat-error";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatSidebar } from "./chat-sidebar";
import { useAutoScroll } from "@/features/ai/hooks/use-auto-scroll";
import { useAutoTitle } from "@/features/ai/hooks/use-auto-title";
import { useChatClient } from "@/features/ai/hooks/use-chat-client";
import { ChatMessage } from "./message/chat-message";

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
	const [scrollTrigger, setScrollTrigger] = useState(0);

	useAutoScroll(bottomRef, scrollTrigger);
	useAutoTitle(activeId, messages, conversations);
	const {
		chatClient,
		assistantMetrics,
		pendingSendStartedAtRef,
		chatTokenTotals,
	} = useChatClient(activeId);

	async function handleSend() {
		const text = input.trim();
		if (!text || isLoading || !chatClient) return;
		pendingSendStartedAtRef.current = Date.now();
		setScrollTrigger((prev) => prev + 1);
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
				<div className="rounded-none border-none flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden space-y-0 gap-0">
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
						{error && <ChatError error={error} />}
						<div ref={bottomRef} />
					</CardContent>
					<ChatInput
						input={input}
						onInputChange={setInput}
						onSend={handleSend}
						isLoading={isLoading}
						inputTokens={chatTokenTotals.inputTokens}
						outputTokens={chatTokenTotals.outputTokens}
						contextTokens={chatTokenTotals.contextTokens}
					/>
				</div>
			</div>
		</div>
	);
}
