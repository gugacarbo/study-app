import { useStore } from "@tanstack/react-store";
import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	conversationsStore,
	createConversation,
	deleteConversation,
	setActiveConversation,
} from "@/stores/conversationsStore";

export function ChatSidebar() {
	const { conversations, activeId } = useStore(conversationsStore, (s) => ({
		conversations: s.conversations,
		activeId: s.activeId,
	}));

	function handleSelect(id: string) {
		setActiveConversation(id);
	}

	function handleDelete(e: React.MouseEvent, id: string) {
		e.stopPropagation();
		deleteConversation(id);
	}

	function handleNew() {
		createConversation();
	}

	return (
		<div className="flex flex-col w-64 border-r border-border bg-muted/20 shrink-0">
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b border-border">
				<span className="text-sm font-semibold">Chats</span>
			</div>

			{/* New Chat button */}
			<div className="p-2">
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start gap-2"
					onClick={handleNew}
				>
					<Plus className="h-4 w-4" />
					New Chat
				</Button>
			</div>

			{/* Conversation list */}
			<div className="flex-1 overflow-y-auto">
				{conversations.length === 0 ? (
					<p className="text-xs text-muted-foreground text-center py-8">
						No conversations yet
					</p>
				) : (
					conversations.map((conv) => (
						<button
							key={conv.id}
							type="button"
							onClick={() => handleSelect(conv.id)}
							className={`group w-full text-left px-3 py-2.5 flex items-start gap-2 text-sm transition-colors hover:bg-muted/50 border-b border-border/40 ${
								activeId === conv.id ? "bg-muted/70 font-medium" : ""
							}`}
						>
							<MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
							<div className="flex-1 min-w-0">
								<div className="truncate">{conv.title}</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									{new Date(conv.updatedAt).toLocaleDateString()}
								</div>
							</div>
							<button
								type="button"
								onClick={(e) => handleDelete(e, conv.id)}
								className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive mt-0.5"
								title="Delete conversation"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</button>
					))
				)}
			</div>
		</div>
	);
}
