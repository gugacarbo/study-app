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
import {
	conversationsStore,
	createConversation,
	deleteConversation,
	setActiveConversation,
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

export function ChatSidebar() {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	const [pending, setPending] = useState(false);

	const { conversations, activeId } = useSelector(conversationsStore, (s) => ({
		conversations: s.conversations,
		activeId: s.activeId,
	}));

	async function handleCreate() {
		if (pending) return;
		setPending(true);
		try {
			await createConversation();
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
				{conversations.length === 0
					? !collapsed && (
							<div className="px-4 py-8 text-center text-xs text-muted-foreground">
								No conversations yet
							</div>
						)
					: conversations.map((conv) => {
							const isActive = activeId === conv.id;
							const btn = (
								<button
									key={conv.id}
									type="button"
									onClick={() => void handleSelect(conv.id)}
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
										<span className="min-w-0 truncate">{conv.title}</span>
									)}
								</button>
							);

							return (
								<div
									key={conv.id}
									className="group/item relative flex items-center px-2 py-0.5"
								>
									{collapsed ? (
										<Tooltip>
											<TooltipTrigger asChild>{btn}</TooltipTrigger>
											<TooltipContent side="right">{conv.title}</TooltipContent>
										</Tooltip>
									) : (
										btn
									)}
									{!collapsed && (
										<button
											type="button"
											onClick={() => void handleDelete(conv.id)}
											disabled={pending}
											className="absolute right-2 top-1/2 -translate-y-1/2 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-destructive"
											title="Delete conversation"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									)}
								</div>
							);
						})}
			</div>
		</aside>
	);
}
