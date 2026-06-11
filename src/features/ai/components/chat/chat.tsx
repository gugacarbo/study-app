import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useMemo, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { createStudyChatComposer } from "@/features/ai/components/assistant-ui/study-chat-composer";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { WELCOME } from "@/features/ai/components/chat/chat-utils";
import { useAssistantChatRuntime } from "@/features/ai/hooks/use-assistant-chat-runtime";
import { useAutoTitle } from "@/features/ai/hooks/use-auto-title";
import { useChatClient } from "@/features/ai/hooks/use-chat-client";
import { chatStore } from "@/features/ai/stores/chat-store";
import {
	conversationsStore,
	hydrateConversationsFromStorage,
	updateConversationTitle,
} from "@/features/ai/stores/conversations-store";
import { ChatHeader } from "./chat-header";
import { ChatSidebar } from "./chat-sidebar";

export function Chat() {
	const messages = useSelector(chatStore, (s) => s.messages);
	const error = useSelector(chatStore, (s) => s.error);
	const activeId = useSelector(conversationsStore, (s) => s.activeId);
	const conversations = useSelector(conversationsStore, (s) => s.conversations);

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [reviewMode, setReviewMode] = useState(false);

	useEffect(() => {
		hydrateConversationsFromStorage();
	}, []);

	useAutoTitle(activeId, messages, conversations);
	const { chatClient, pendingSendStartedAtRef, chatTokenTotals } =
		useChatClient(activeId);

	const runtime = useAssistantChatRuntime({
		chatClient,
		reviewMode,
		pendingSendStartedAtRef,
	});

	const threadComponents = useMemo(
		() => ({
			Composer: createStudyChatComposer({
				reviewMode,
				onReviewModeChange: setReviewMode,
				inputTokens: chatTokenTotals.inputTokens,
				outputTokens: chatTokenTotals.outputTokens,
				contextTokens: chatTokenTotals.contextTokens,
			}),
			Welcome: StudyWelcome,
		}),
		[
			reviewMode,
			chatTokenTotals.inputTokens,
			chatTokenTotals.outputTokens,
			chatTokenTotals.contextTokens,
		],
	);

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
					<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<AssistantRuntimeProvider runtime={runtime}>
							<Thread components={threadComponents} />
						</AssistantRuntimeProvider>
					</div>
					{error ? (
						<div className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error.message}
						</div>
					) : null}
				</main>
			</SidebarProvider>
		</div>
	);
}

function StudyWelcome() {
	return (
		<div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
			<h1 className="aui-thread-welcome-message-inner text-2xl font-semibold">
				{WELCOME.parts[0]?.type === "text"
					? WELCOME.parts[0].content
					: "How can I help you today?"}
			</h1>
		</div>
	);
}
