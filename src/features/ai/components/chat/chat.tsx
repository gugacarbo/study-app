import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAutoTitle } from "@/features/ai/hooks/use-auto-title";
import { useChatClient } from "@/features/ai/hooks/use-chat-client";
import { chatStore, setInput } from "@/features/ai/stores/chat-store";
import {
	conversationsStore,
	updateConversationTitle,
} from "@/features/ai/stores/conversations-store";
import { ChatError } from "./chat-error";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatSidebar } from "./chat-sidebar";
import { VirtualizedChatMessages } from "./virtualized-chat-messages";

export function Chat() {
	const messages = useSelector(chatStore, (s) => s.messages);
	const isLoading = useSelector(chatStore, (s) => s.isLoading);
	const error = useSelector(chatStore, (s) => s.error);
	const input = useSelector(chatStore, (s) => s.input);
	const activeId = useSelector(conversationsStore, (s) => s.activeId);
	const conversations = useSelector(conversationsStore, (s) => s.conversations);

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [reviewMode, setReviewMode] = useState(false);

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
		setInput("");
		await chatClient.sendMessage(text, { reviewMode });
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
		<div data-fullwidth className="flex h-full overflow-hidden">
			<SidebarProvider className="flex min-h-0 h-full">
				<ChatSidebar />
				<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
						<SidebarTrigger />
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
					</header>
					<VirtualizedChatMessages
						messages={messages}
						metrics={assistantMetrics}
					/>
					{error && <ChatError error={error} />}
					<ChatInput
						input={input}
						onInputChange={setInput}
						onSend={handleSend}
						isLoading={isLoading}
						reviewMode={reviewMode}
						onReviewModeChange={setReviewMode}
						inputTokens={chatTokenTotals.inputTokens}
						outputTokens={chatTokenTotals.outputTokens}
						contextTokens={chatTokenTotals.contextTokens}
					/>
				</main>
			</SidebarProvider>
		</div>
	);
}
