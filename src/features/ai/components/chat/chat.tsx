import { useSelector } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatConversation } from "@/features/ai/components/chat/chat-conversation";
import { useAutoTitle } from "@/features/ai/hooks/use-auto-title";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import { PipelineErrorBanner } from "@/features/ai/pipeline/ui";
import {
	conversationsStore,
	ensureActiveConversation,
	hydrateConversationsFromServer,
} from "@/features/ai/stores/conversations-store";
import {
	getLayoutUIStore,
	hydrateLayoutUIStore,
	setChatSidebarOpen,
} from "@/features/ai/stores/ui-store";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "@/lib/chat-conversations/constants";
import { updateConversationTitle } from "@/features/ai/stores/conversations-store";
import { CopyChatRequestButton } from "@/features/ai/components/chat/copy-chat-request-button";
import { ChatHeader } from "./chat-header";
import { ChatSidebar } from "./chat-sidebar";

export function Chat() {
	const activeId = useSelector(conversationsStore, (s) => s.activeId);
	const conversations = useSelector(conversationsStore, (s) => s.conversations);
	const messages = useSelector(conversationsStore, (s) =>
		activeId ? (s.messagesMap[activeId] ?? []) : [],
	);
	const isHydrating = useSelector(conversationsStore, (s) => s.isHydrating);
	const loadingConversationId = useSelector(
		conversationsStore,
		(s) => s.loadingConversationId,
	);
	const chatSidebarOpen = useSelector(
		getLayoutUIStore(),
		(s) => s.chatSidebarOpen,
	);
	const activeConversation = conversations.find((c) => c.id === activeId);
	const isTruncated =
		(activeConversation?.messageCount ?? 0) > CHAT_RUNTIME_MESSAGE_LIMIT;

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [reviewMode, setReviewMode] = useState(false);
	const [chatError, setChatError] = useState<PipelineErrorState | null>(null);

	useEffect(() => {
		hydrateLayoutUIStore();
		void (async () => {
			await hydrateConversationsFromServer();
			await ensureActiveConversation();
		})();
	}, []);

	useAutoTitle(activeId, messages, conversations);

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

	const isLoading = isHydrating || loadingConversationId === activeId;

	return (
		<div data-fullwidth className="flex h-full overflow-hidden">
			<SidebarProvider
				open={chatSidebarOpen}
				onOpenChange={setChatSidebarOpen}
				className="flex min-h-0 h-full"
			>
				<ChatSidebar variant="grouped" />
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
						<div className="ms-auto flex items-center gap-1">
							<CopyChatRequestButton
								title="Copy conversation request JSON"
								disabled={messages.length === 0}
							/>
						</div>
					</header>
					{isTruncated ? (
						<div className="shrink-0 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
							Showing last {CHAT_RUNTIME_MESSAGE_LIMIT} messages
						</div>
					) : null}
					<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						{isLoading ? (
							<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
								Loading conversation…
							</div>
						) : activeId ? (
							<ChatConversation
								key={activeId}
								conversationId={activeId}
								reviewMode={reviewMode}
								onReviewModeChange={setReviewMode}
								onError={setChatError}
							/>
						) : null}
					</div>
					{chatError ? (
						<PipelineErrorBanner
							error={chatError}
							onDismiss={() => setChatError(null)}
							className="rounded-none border-x-0 border-b-0"
						/>
					) : null}
				</main>
			</SidebarProvider>
		</div>
	);
}
