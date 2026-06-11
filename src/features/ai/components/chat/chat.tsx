import {
	AssistantChatTransport,
	useChatRuntime,
	useThreadTokenUsage,
} from "@assistant-ui/react-ai-sdk";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { createStudyChatComposer } from "@/features/ai/components/assistant-ui/study-chat-composer";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { WELCOME } from "@/features/ai/components/chat/chat-utils";
import { useAutoTitle } from "@/features/ai/hooks/use-auto-title";
import {
	conversationsStore,
	createConversationHistoryAdapter,
	ensureActiveConversation,
	flushConversationSave,
	hydrateConversationsFromServer,
	updateConversationTitle,
} from "@/features/ai/stores/conversations-store";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "@/lib/chat-conversations/constants";
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
	const activeConversation = conversations.find((c) => c.id === activeId);
	const isTruncated =
		(activeConversation?.messageCount ?? 0) > CHAT_RUNTIME_MESSAGE_LIMIT;

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [reviewMode, setReviewMode] = useState(false);
	const [chatError, setChatError] = useState<Error | undefined>();

	useEffect(() => {
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
						<div className="shrink-0 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{chatError.message}
						</div>
					) : null}
				</main>
			</SidebarProvider>
		</div>
	);
}

interface ChatConversationProps {
	conversationId: string;
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	onError: (error: Error | undefined) => void;
}

function ChatConversation({
	conversationId,
	reviewMode,
	onReviewModeChange,
	onError,
}: ChatConversationProps) {
	const reviewModeRef = useRef(reviewMode);
	reviewModeRef.current = reviewMode;

	const conversationIdRef = useRef(conversationId);
	conversationIdRef.current = conversationId;

	const transport = useMemo(
		() =>
			new AssistantChatTransport({
				api: "/api/chat",
				prepareSendMessagesRequest: async (options) => ({
					body: {
						...(options.body as Record<string, unknown>),
						messages: options.messages,
						reviewMode: reviewModeRef.current,
						conversationId: conversationIdRef.current,
					},
				}),
			}),
		[],
	);

	const historyAdapter = useMemo(
		() => createConversationHistoryAdapter(() => conversationIdRef.current),
		[],
	);

	const runtime = useChatRuntime({
		transport,
		adapters: { history: historyAdapter },
		onError: (error) => onError(error),
		onFinish: () => {
			void flushConversationSave(conversationIdRef.current);
		},
	});

	return (
		<StudyAssistantRuntimeProvider runtime={runtime}>
			<ChatThread
				reviewMode={reviewMode}
				onReviewModeChange={onReviewModeChange}
			/>
		</StudyAssistantRuntimeProvider>
	);
}

interface ChatThreadProps {
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
}

function ChatThread({ reviewMode, onReviewModeChange }: ChatThreadProps) {
	const tokenUsage = useThreadTokenUsage();
	const inputTokens = tokenUsage?.inputTokens ?? 0;
	const outputTokens = tokenUsage?.outputTokens ?? 0;
	const contextTokens = tokenUsage?.inputTokens ?? 0;

	const threadComponents = useMemo(
		() => ({
			Composer: createStudyChatComposer({
				reviewMode,
				onReviewModeChange,
				inputTokens,
				outputTokens,
				contextTokens,
			}),
			Welcome: StudyWelcome,
		}),
		[reviewMode, onReviewModeChange, inputTokens, outputTokens, contextTokens],
	);

	return <Thread components={threadComponents} />;
}

function StudyWelcome() {
	return (
		<div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
			<h1 className="aui-thread-welcome-message-inner text-2xl font-semibold">
				{WELCOME.parts[0]?.type === "text"
					? WELCOME.parts[0].text
					: "How can I help you today?"}
			</h1>
		</div>
	);
}
