import { useSelector } from "@tanstack/react-store";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePageChatContext } from "@/features/ai/context/page-chat-context";
import {
	conversationsStore,
	createConversation,
	deleteConversation,
	getConversationsGrouped,
	setActiveConversation,
	type Conversation,
	type GroupedConversations,
} from "@/features/ai/stores/conversations-store";
import { cn } from "@/lib/utils";

function NewChatButton({
	collapsed,
	disabled,
	onCreate,
}: {
	collapsed: boolean;
	disabled: boolean;
	onCreate: () => void;
}) {
	const btn = (
		<Button
			variant="outline"
			type="button"
			onClick={onCreate}
			disabled={disabled}
			className={cn(collapsed ? "" : "justify-start")}
			title="New Chat"
		>
			<Plus className="h-4 w-4 shrink-0" />
			{!collapsed && <span>New Chat</span>}
		</Button>
	);

	if (collapsed) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{btn}</TooltipTrigger>
				<TooltipContent side="right">New Chat</TooltipContent>
			</Tooltip>
		);
	}

	return btn;
}

interface ChatSidebarProps {
	variant?: "default" | "grouped";
}

export function ChatSidebar({ variant = "default" }: ChatSidebarProps) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	const [pending, setPending] = useState(false);
	const pageContext = usePageChatContext();

	const { conversations, activeId } = useSelector(conversationsStore, (s) => ({
		conversations: s.conversations,
		activeId: s.activeId,
	}));
	const grouped = useSelector(conversationsStore, (s) =>
		getConversationsGrouped(s.conversations, pageContext.contextKey),
	);

	async function handleCreate() {
		if (pending) return;
		setPending(true);
		try {
			await createConversation(
				variant === "grouped" ? pageContext.contextKey : undefined,
			);
		} finally {
			setPending(false);
		}
	}

	async function handleSelect(id: string) {
		if (pending) return;
		setPending(true);
		try {
			await setActiveConversation(id);
		} finally {
			setPending(false);
		}
	}

	async function handleDelete(id: string) {
		if (pending) return;
		setPending(true);
		try {
			await deleteConversation(id);
		} finally {
			setPending(false);
		}
	}

	return (
		<aside
			data-slot="chat-sidebar"
			data-state={state}
			data-collapsible={collapsed ? "icon" : ""}
			className={cn(
				"group/sidebar relative flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-linear",
				collapsed ? "w-12" : "w-64",
			)}
		>
			<div className="border-b border-border px-3 py-3">
				<NewChatButton
					collapsed={collapsed}
					disabled={pending}
					onCreate={() => void handleCreate()}
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{conversations.length === 0 ? (
					!collapsed && (
						<div className="px-4 py-8 text-center text-xs text-muted-foreground">
							No conversations yet
						</div>
					)
				) : variant === "grouped" && !collapsed ? (
					<GroupedSidebarList
						grouped={grouped}
						activeId={activeId}
						pending={pending}
						onSelect={handleSelect}
						onDelete={handleDelete}
					/>
				) : (
					conversations.map((conv) => (
						<ConversationRow
							key={conv.id}
							conversation={conv}
							isActive={activeId === conv.id}
							collapsed={collapsed}
							pending={pending}
							onSelect={handleSelect}
							onDelete={handleDelete}
						/>
					))
				)}
			</div>
		</aside>
	);
}

function GroupedSidebarList({
	grouped,
	activeId,
	pending,
	onSelect,
	onDelete,
}: {
	grouped: GroupedConversations;
	activeId: string | null;
	pending: boolean;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<>
			<SidebarGroup
				label="Esta página"
				conversations={grouped.currentPage}
				activeId={activeId}
				pending={pending}
				onSelect={onSelect}
				onDelete={onDelete}
			/>
			<SidebarGroup
				label="Outras páginas"
				conversations={grouped.otherPages}
				activeId={activeId}
				pending={pending}
				onSelect={onSelect}
				onDelete={onDelete}
			/>
			<SidebarGroup
				label="Geral"
				conversations={grouped.general}
				activeId={activeId}
				pending={pending}
				onSelect={onSelect}
				onDelete={onDelete}
			/>
		</>
	);
}

function SidebarGroup({
	label,
	conversations,
	activeId,
	pending,
	onSelect,
	onDelete,
}: {
	label: string;
	conversations: Conversation[];
	activeId: string | null;
	pending: boolean;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	if (conversations.length === 0) return null;

	return (
		<div className="px-2 py-2">
			<p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			{conversations.map((conv) => (
				<ConversationRow
					key={conv.id}
					conversation={conv}
					isActive={activeId === conv.id}
					collapsed={false}
					pending={pending}
					onSelect={onSelect}
					onDelete={onDelete}
				/>
			))}
		</div>
	);
}

function ConversationRow({
	conversation,
	isActive,
	collapsed,
	pending,
	onSelect,
	onDelete,
}: {
	conversation: Conversation;
	isActive: boolean;
	collapsed: boolean;
	pending: boolean;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	const btn = (
		<button
			type="button"
			onClick={() => void onSelect(conversation.id)}
			disabled={pending}
			className={cn(
				"group/item flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
				isActive
					? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
					: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
				collapsed && "justify-center",
			)}
		>
			<MessageSquare className="h-4 w-4 shrink-0" />
			{!collapsed && (
				<span className="min-w-0 truncate">{conversation.title}</span>
			)}
		</button>
	);

	return (
		<div className="group/item relative flex items-center px-2 py-0.5">
			{collapsed ? (
				<Tooltip>
					<TooltipTrigger asChild>{btn}</TooltipTrigger>
					<TooltipContent side="right">{conversation.title}</TooltipContent>
				</Tooltip>
			) : (
				btn
			)}
			{!collapsed && (
				<button
					type="button"
					onClick={() => void onDelete(conversation.id)}
					disabled={pending}
					className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-destructive"
					title="Delete conversation"
				>
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);
}
