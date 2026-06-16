import { useSelector } from "@tanstack/react-store";
import { Expand, Menu, Minimize2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatConversation } from "@/features/ai/components/chat/chat-conversation";
import {
	type PageChatContext,
	usePageChatContext,
} from "@/features/ai/context/page-chat-context";
import { getPageChatSuggestions } from "@/features/ai/lib/page-chat-suggestions";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import { PipelineErrorBanner } from "@/features/ai/pipeline/ui";
import {
	conversationsStore,
	createConversation,
	ensureActiveConversation,
	getConversationsGrouped,
	hydrateConversationsFromServer,
	setActiveConversation,
	type GroupedConversations,
} from "@/features/ai/stores/conversations-store";
import {
	getLayoutUIStore,
	setHeaderChatError,
	setHeaderChatStreaming,
	setHeaderChatView,
	toggleHeaderChatConversationsOpen,
} from "@/features/ai/stores/ui-store";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "@/lib/chat-conversations/constants";
import { cn } from "@/lib/utils";

interface HeaderChatPanelProps {
	variant: "popover" | "sheet";
	onExpand?: () => void;
	onCollapse?: () => void;
}

export function HeaderChatPanel({
	variant,
	onExpand,
	onCollapse,
}: HeaderChatPanelProps) {
	const pageContext = usePageChatContext();
	const activeId = useSelector(conversationsStore, (s) => s.activeId);
	const conversations = useSelector(conversationsStore, (s) => s.conversations);
	const isHydrating = useSelector(conversationsStore, (s) => s.isHydrating);
	const loadingConversationId = useSelector(
		conversationsStore,
		(s) => s.loadingConversationId,
	);
	const grouped = useSelector(conversationsStore, (s) =>
		getConversationsGrouped(s.conversations, pageContext.contextKey),
	);

	const activeConversation = conversations.find((c) => c.id === activeId);
	const conversationsOpen = useSelector(
		getLayoutUIStore(),
		(s) => s.headerChatConversationsOpen,
	);
	const [reviewMode, setReviewMode] = useState(false);
	const [chatError, setChatError] = useState<PipelineErrorState | null>(null);
	const [pending, setPending] = useState(false);

	useEffect(() => {
		void (async () => {
			await hydrateConversationsFromServer();
			await ensureActiveConversation();
		})();
	}, []);

	useEffect(() => {
		setHeaderChatError(chatError !== null);
	}, [chatError]);

	const isLoading = isHydrating || loadingConversationId === activeId;
	const isTruncated =
		(activeConversation?.messageCount ?? 0) > CHAT_RUNTIME_MESSAGE_LIMIT;
	const suggestions = getPageChatSuggestions(pageContext.pageType);
	const pageContextPayload = toPageContextPayload(pageContext);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderChatPanelToolbar
				title={activeConversation?.title ?? "Chat"}
				variant={variant}
				conversationsOpen={conversationsOpen}
				onToggleConversations={toggleHeaderChatConversationsOpen}
				onExpand={onExpand}
				onCollapse={onCollapse}
				onNewConversation={() => void handleNewConversation(pageContext, setPending)}
				pending={pending}
			/>

			<div className="flex min-h-0 flex-1 overflow-hidden">
				{conversationsOpen ? (
					<GroupedConversationList
						grouped={grouped}
						activeId={activeId}
						pending={pending}
						compact={variant === "popover"}
						onSelect={(id) => void handleSelect(id, setPending)}
					/>
				) : null}

				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					{isTruncated ? (
						<div className="shrink-0 border-b bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
							Últimas {CHAT_RUNTIME_MESSAGE_LIMIT} mensagens
						</div>
					) : null}
					{isLoading ? (
						<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
							Carregando…
						</div>
					) : activeId ? (
						<ChatConversation
							key={activeId}
							conversationId={activeId}
							reviewMode={reviewMode}
							onReviewModeChange={setReviewMode}
							onError={setChatError}
							onRunningChange={setHeaderChatStreaming}
							compact
							pageContext={pageContextPayload}
							clientTools={pageContext.clientTools}
							suggestions={suggestions}
						/>
					) : null}
				</div>
			</div>

			{chatError ? (
				<PipelineErrorBanner
					error={chatError}
					onDismiss={() => setChatError(null)}
					className="rounded-none border-x-0 border-b-0 text-xs"
				/>
			) : null}
		</div>
	);
}

function HeaderChatPanelToolbar({
	title,
	variant,
	conversationsOpen,
	onToggleConversations,
	onExpand,
	onCollapse,
	onNewConversation,
	pending,
}: {
	title: string;
	variant: "popover" | "sheet";
	conversationsOpen: boolean;
	onToggleConversations: () => void;
	onExpand?: () => void;
	onCollapse?: () => void;
	onNewConversation: () => void;
	pending: boolean;
}) {
	return (
		<div className="flex shrink-0 items-center gap-1 border-b px-1.5 py-1">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-6 shrink-0"
				onClick={onToggleConversations}
				title={conversationsOpen ? "Ocultar conversas" : "Mostrar conversas"}
				aria-pressed={conversationsOpen}
			>
				<Menu className="size-3.5" />
			</Button>
			<p className="min-w-0 flex-1 truncate text-xs font-medium">{title}</p>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-6 shrink-0"
				disabled={pending}
				onClick={onNewConversation}
				title="Nova conversa"
			>
				<Plus className="size-3.5" />
			</Button>
			{variant === "popover" && onExpand ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="size-6 shrink-0"
					onClick={onExpand}
					title="Expandir"
				>
					<Expand className="size-3.5" />
				</Button>
			) : null}
			{variant === "sheet" && onCollapse ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="size-6 shrink-0"
					onClick={onCollapse}
					title="Recolher"
				>
					<Minimize2 className="size-3.5" />
				</Button>
			) : null}
		</div>
	);
}

function GroupedConversationList({
	grouped,
	activeId,
	pending,
	compact,
	onSelect,
}: {
	grouped: GroupedConversations;
	activeId: string | null;
	pending: boolean;
	compact: boolean;
	onSelect: (id: string) => void;
}) {
	return (
		<div
			className={cn(
				"shrink-0 overflow-y-auto border-r bg-muted/20",
				compact ? "w-36" : "w-44",
			)}
		>
			<ConversationGroup
				label="Esta página"
				conversations={grouped.currentPage}
				activeId={activeId}
				pending={pending}
				onSelect={onSelect}
			/>
			<ConversationGroup
				label="Outras páginas"
				conversations={grouped.otherPages}
				activeId={activeId}
				pending={pending}
				onSelect={onSelect}
			/>
			<ConversationGroup
				label="Geral"
				conversations={grouped.general}
				activeId={activeId}
				pending={pending}
				onSelect={onSelect}
			/>
		</div>
	);
}

function ConversationGroup({
	label,
	conversations,
	activeId,
	pending,
	onSelect,
}: {
	label: string;
	conversations: Array<{ id: string; title: string }>;
	activeId: string | null;
	pending: boolean;
	onSelect: (id: string) => void;
}) {
	if (conversations.length === 0) return null;

	return (
		<div className="px-1 py-2">
			<p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			{conversations.map((conversation) => (
				<button
					key={conversation.id}
					type="button"
					disabled={pending}
					onClick={() => onSelect(conversation.id)}
					className={cn(
						"flex w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors",
						activeId === conversation.id
							? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
							: "hover:bg-sidebar-accent/60",
					)}
				>
					{conversation.title}
				</button>
			))}
		</div>
	);
}

function toPageContextPayload(pageContext: PageChatContext) {
	return {
		contextKey: pageContext.contextKey,
		pageType: pageContext.pageType,
		label: pageContext.label,
		route: pageContext.route,
		examId: pageContext.examId,
		questionId: pageContext.questionId,
		summary: pageContext.summary,
	};
}

async function handleNewConversation(
	pageContext: PageChatContext,
	setPending: (value: boolean) => void,
) {
	setPending(true);
	try {
		await createConversation(pageContext.contextKey);
	} finally {
		setPending(false);
	}
}

async function handleSelect(id: string, setPending: (value: boolean) => void) {
	setPending(true);
	try {
		await setActiveConversation(id);
	} finally {
		setPending(false);
	}
}

export function CompactChatPanel() {
	return (
		<HeaderChatPanel
			variant="popover"
			onExpand={() => setHeaderChatView("sheet")}
		/>
	);
}

export function ExpandedChatSheet() {
	return (
		<HeaderChatPanel
			variant="sheet"
			onCollapse={() => setHeaderChatView("popover")}
		/>
	);
}
