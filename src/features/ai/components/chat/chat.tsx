import {
	AssistantChatTransport,
	useChatRuntime,
	useThreadTokenUsage,
} from "@assistant-ui/react-ai-sdk";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { AiModelPublic } from "@/db/queries/types";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { createStudyChatComposer } from "@/features/ai/components/assistant-ui/study-chat-composer";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { WELCOME } from "@/features/ai/components/chat/chat-utils";
import { useAutoTitle } from "@/features/ai/hooks/use-auto-title";
import { useEnabledAiModels } from "@/features/ai/hooks/use-enabled-models";
import { errorToPipelineErrorState } from "@/features/ai/pipeline/client";
import { PipelineErrorBanner } from "@/features/ai/pipeline/ui";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import {
	conversationsStore,
	createConversationHistoryAdapter,
	ensureActiveConversation,
	flushConversationSave,
	hydrateConversationsFromServer,
	updateConversationTitle,
} from "@/features/ai/stores/conversations-store";
import {
	hydrateLayoutUIStore,
	getLayoutUIStore,
	setChatSidebarOpen,
} from "@/features/ai/stores/ui-store";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "@/lib/chat-conversations/constants";
import { getAiSettings } from "@/server-functions/ai-settings";
import { ChatHeader } from "./chat-header";
import { ChatSidebar } from "./chat-sidebar";

function resolveInitialModelId(
	models: AiModelPublic[],
	settings: {
		defaultModelId: number | null;
		agentModels: Record<string, number | null>;
	},
): number | undefined {
	if (models.length === 0) return undefined;
	const preferred = settings.agentModels.chat ?? settings.defaultModelId;
	if (preferred && models.some((m) => m.id === preferred)) return preferred;
	return models[0]?.id;
}

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
	const chatSidebarOpen = useSelector(getLayoutUIStore(), (s) => s.chatSidebarOpen);
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

interface ChatConversationProps {
	conversationId: string;
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	onError: (error: PipelineErrorState | null) => void;
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

	const { data: models = [] } = useEnabledAiModels();
	const { data: settings } = useSuspenseQuery({
		queryKey: ["ai-settings"],
		queryFn: () => getAiSettings(),
	});

	const [selectedModelId, setSelectedModelId] = useState<number | undefined>(() =>
		resolveInitialModelId(models, settings),
	);

	const selectedModelIdRef = useRef(selectedModelId);
	selectedModelIdRef.current = selectedModelId;

	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	const transport = useMemo(
		() =>
			new AssistantChatTransport({
				api: "/api/chat",
				prepareSendMessagesRequest: async (options) => {
					onErrorRef.current(null);
					return {
						body: {
							...(options.body as Record<string, unknown>),
							messages: options.messages,
							reviewMode: reviewModeRef.current,
							conversationId: conversationIdRef.current,
							modelId: selectedModelIdRef.current,
						},
					};
				},
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
		onError: (error) => onError(errorToPipelineErrorState(error)),
		onFinish: () => {
			void flushConversationSave(conversationIdRef.current);
		},
	});

	return (
		<StudyAssistantRuntimeProvider runtime={runtime}>
			<ChatThread
				reviewMode={reviewMode}
				onReviewModeChange={onReviewModeChange}
				models={models}
				selectedModelId={selectedModelId}
				onSelectedModelChange={setSelectedModelId}
			/>
		</StudyAssistantRuntimeProvider>
	);
}

interface ChatThreadProps {
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	models: AiModelPublic[];
	selectedModelId: number | undefined;
	onSelectedModelChange: (modelId: number) => void;
}

function ChatThread({
	reviewMode,
	onReviewModeChange,
	models,
	selectedModelId,
	onSelectedModelChange,
}: ChatThreadProps) {
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
				models,
				selectedModelId: selectedModelId ?? null,
				onSelectedModelChange,
			}),
			Welcome: StudyWelcome,
		}),
		[
			reviewMode,
			onReviewModeChange,
			inputTokens,
			outputTokens,
			contextTokens,
			models,
			selectedModelId,
			onSelectedModelChange,
		],
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
