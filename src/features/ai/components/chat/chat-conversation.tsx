import { useAuiState, useComposerRuntime } from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
	useThreadTokenUsage,
} from "@assistant-ui/react-ai-sdk";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { MessageTiming } from "@assistant-ui/core";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { AiModelPublic } from "@/db/queries/types";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { createStudyChatComposer } from "@/features/ai/components/assistant-ui/study-chat-composer";
import { ChatMessagePerfCache } from "@/features/ai/components/chat/chat-message-perf-cache";
import { ChatRuntimeStatsSync } from "@/features/ai/components/chat/chat-runtime-stats-sync";
import { enrichMessagesWithChatPerf } from "@/features/ai/lib/chat-message-perf";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import { WELCOME } from "@/features/ai/components/chat/chat-utils";
import { useEnabledAiModels } from "@/features/ai/hooks/use-enabled-models";
import type { PageChatContextPayload } from "@/features/ai/context/page-chat-context";
import type { PageChatSuggestion } from "@/features/ai/lib/page-chat-suggestions";
import { errorToPipelineErrorState } from "@/features/ai/pipeline/client";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import {
	createConversationHistoryAdapter,
	getConversationMessages,
	flushConversationSave,
	saveMessagesToConversation,
} from "@/features/ai/stores/conversations-store";
import { getAiSettings } from "@/server-functions/ai-settings";
import type { ParsedClientTools } from "@/routes/api/chat/-schema";
import { cn } from "@/lib/utils";

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

export interface ChatConversationProps {
	conversationId: string;
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	onError: (error: PipelineErrorState | null) => void;
	onRunningChange?: (running: boolean) => void;
	compact?: boolean;
	pageContext?: PageChatContextPayload | null;
	clientTools?: ParsedClientTools;
	suggestions?: PageChatSuggestion[];
}

export function ChatConversation({
	conversationId,
	reviewMode,
	onReviewModeChange,
	onError,
	onRunningChange,
	compact = false,
	pageContext = null,
	clientTools,
	suggestions = [],
}: ChatConversationProps) {
	const reviewModeRef = useRef(reviewMode);
	reviewModeRef.current = reviewMode;

	const conversationIdRef = useRef(conversationId);
	conversationIdRef.current = conversationId;

	const pageContextRef = useRef(pageContext);
	pageContextRef.current = pageContext;

	const clientToolsRef = useRef(clientTools);
	clientToolsRef.current = clientTools;

	const { data: models = [] } = useEnabledAiModels();
	const { data: settings } = useSuspenseQuery({
		queryKey: ["ai-settings"],
		queryFn: () => getAiSettings(),
	});

	const [selectedModelId, setSelectedModelId] = useState<number | undefined>(
		() => resolveInitialModelId(models, settings),
	);

	const selectedModelIdRef = useRef(selectedModelId);
	selectedModelIdRef.current = selectedModelId;

	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	const perfTimingsRef = useRef<Record<string, MessageTiming>>({});

	const persistEnrichedMessages = (
		messages: Parameters<typeof enrichMessagesWithChatPerf>[0],
		attempt = 0,
	) => {
		const assistantIds = messages
			.filter((message) => message.role === "assistant")
			.map((message) => message.id);
		const timingReady =
			assistantIds.length === 0 ||
			assistantIds.every(
				(id) => perfTimingsRef.current[id]?.totalStreamTime != null,
			);

		if (!timingReady && attempt < 30) {
			window.setTimeout(
				() => persistEnrichedMessages(messages, attempt + 1),
				16,
			);
			return;
		}

		const enriched = enrichMessagesWithChatPerf(
			messages,
			perfTimingsRef.current,
		);
		saveMessagesToConversation(conversationIdRef.current, enriched);
		void flushConversationSave(conversationIdRef.current);
	};

	const initialMessages = useMemo(
		() =>
			getConversationMessages(conversationId).filter(
				(message) => message.id !== "welcome",
			),
		[conversationId],
	);

	const transport = useMemo(
		() =>
			new AssistantChatTransport({
				api: "/api/chat",
				prepareSendMessagesRequest: async (options) => {
					onErrorRef.current(null);
					const tools = clientToolsRef.current;
					return {
						body: {
							...(options.body as Record<string, unknown>),
							messages: options.messages,
							reviewMode: reviewModeRef.current,
							conversationId: conversationIdRef.current,
							modelId: selectedModelIdRef.current,
							metadata: {
								pageContext: pageContextRef.current ?? undefined,
							},
							...(tools && Object.keys(tools).length > 0
								? { tools }
								: {}),
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
		messages: initialMessages,
		transport,
		adapters: { history: historyAdapter },
		onError: (error) => onError(errorToPipelineErrorState(error)),
		onFinish: ({ messages }) => {
			window.setTimeout(() => persistEnrichedMessages(messages), 0);
		},
	});

	const selectedModel = models.find((model) => model.id === selectedModelId);

	return (
		<StudyAssistantRuntimeProvider runtime={runtime}>
			<ChatMessagePerfCache cacheRef={perfTimingsRef} />
			<ChatRuntimeStatsSync
				conversationId={conversationId}
				selectedModel={selectedModel}
			/>
			<ThreadRunningObserver onRunningChange={onRunningChange}>
				<ChatThread
					reviewMode={reviewMode}
					onReviewModeChange={onReviewModeChange}
					models={models}
					selectedModelId={selectedModelId}
					onSelectedModelChange={setSelectedModelId}
					compact={compact}
					suggestions={suggestions}
				/>
			</ThreadRunningObserver>
		</StudyAssistantRuntimeProvider>
	);
}

interface ChatThreadProps {
	reviewMode: boolean;
	onReviewModeChange: (value: boolean) => void;
	models: AiModelPublic[];
	selectedModelId: number | undefined;
	onSelectedModelChange: (modelId: number) => void;
	compact?: boolean;
	suggestions?: PageChatSuggestion[];
}

function ChatThread({
	reviewMode,
	onReviewModeChange,
	models,
	selectedModelId,
	onSelectedModelChange,
	compact = false,
	suggestions = [],
}: ChatThreadProps) {
	const tokenUsage = useThreadTokenUsage();
	const inputTokens = tokenUsage?.inputTokens ?? 0;
	const outputTokens = tokenUsage?.outputTokens ?? 0;
	const contextTokens = tokenUsage?.inputTokens ?? 0;

	const threadComponents = useMemo(
		() => ({
			Composer: createComposerWithSuggestions(
				{
					reviewMode,
					onReviewModeChange,
					inputTokens,
					outputTokens,
					contextTokens,
					models,
					selectedModelId: selectedModelId ?? null,
					onSelectedModelChange,
				},
				suggestions,
			),
			Welcome: compact ? CompactWelcome : StudyWelcome,
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
			compact,
			suggestions,
		],
	);

	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-hidden",
				compact &&
					"[&_[data-slot=aui_thread-viewport]>div]:px-2 [&_[data-slot=aui_thread-viewport]>div]:pt-2 [&_[data-slot=aui_message-group]]:mb-6 [&_[data-slot=aui_message-group]]:gap-y-3 [&_.aui-thread-viewport-footer]:gap-2 [&_.aui-thread-viewport-footer]:pb-2 [&_[data-slot=aui_composer-shell]]:gap-1.5 [&_[data-slot=aui_composer-shell]]:p-1.5 [&_.aui-composer-input]:min-h-10",
			)}
		>
			<Thread components={threadComponents} />
		</div>
	);
}

function createComposerWithSuggestions(
	props: Parameters<typeof createStudyChatComposer>[0],
	suggestions: PageChatSuggestion[],
) {
	const BaseComposer = createStudyChatComposer(props);
	return function ComposerWithSuggestions() {
		const hasMessages = useAuiState((s) => s.thread.messages.length > 0);

		return (
			<div className="flex flex-col gap-2">
				{!hasMessages && suggestions.length > 0 ? (
					<QuickSuggestions suggestions={suggestions} />
				) : null}
				<BaseComposer />
			</div>
		);
	};
}

function QuickSuggestions({
	suggestions,
}: {
	suggestions: PageChatSuggestion[];
}) {
	const composer = useComposerRuntime();

	return (
		<div className="flex shrink-0 flex-wrap gap-1 border-t px-1.5 py-1.5">
			{suggestions.map((suggestion) => (
				<button
					key={suggestion.label}
					type="button"
					className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
					onClick={() => {
						composer.setText(suggestion.message);
						composer.send();
					}}
				>
					{suggestion.label}
				</button>
			))}
		</div>
	);
}

function ThreadRunningObserver({
	onRunningChange,
	children,
}: {
	onRunningChange?: (running: boolean) => void;
	children: ReactNode;
}) {
	const isRunning = useAuiState((state) => state.thread.isRunning);

	useEffect(() => {
		onRunningChange?.(isRunning);
	}, [isRunning, onRunningChange]);

	return children;
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

function CompactWelcome() {
	return (
		<div className="aui-thread-welcome-root mb-2 flex flex-col items-center px-2 text-center">
			<h1 className="aui-thread-welcome-message-inner text-sm font-semibold">
				{WELCOME.parts[0]?.type === "text"
					? WELCOME.parts[0].text
					: "How can I help you today?"}
			</h1>
		</div>
	);
}
