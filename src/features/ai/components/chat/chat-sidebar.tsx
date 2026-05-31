import { useSelector } from "@tanstack/react-store";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	conversationsStore,
	createConversation,
	deleteConversation,
	setActiveConversation,
} from "@/features/ai/stores/conversations-store";

export function ChatSidebar() {
	const { conversations, activeId } = useSelector(conversationsStore, (s) => ({
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
		<aside className="hidden h-full w-64 shrink-0 border-r border-border bg-muted/20 md:flex md:flex-col">
			<div className="border-b border-border px-3 py-3">
				<div className="mb-2 text-sm font-semibold">Chats</div>
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

			<div className="min-h-0 flex-1 overflow-y-auto">
				{conversations.length === 0 ? (
					<div className="px-4 py-8 text-center text-xs text-muted-foreground">
						No conversations yet
					</div>
				) : (
					conversations.map((conv) => (
						<div
							key={conv.id}
							className="group flex w-full items-center gap-2 border-b border-border/40 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
						>
							<button
								type="button"
								onClick={() => handleSelect(conv.id)}
								className={`flex min-w-0 flex-1 items-start gap-2 text-left ${
									activeId === conv.id ? "bg-muted/70 font-medium" : ""
								}`}
							>
								<MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<div className="truncate">{conv.title}</div>
									<div className="mt-0.5 text-[11px] text-muted-foreground">
										{new Date(conv.updatedAt).toLocaleDateString()}
									</div>
								</div>
							</button>
							<button
								type="button"
								onClick={(e) => handleDelete(e, conv.id)}
								className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
								title="Delete conversation"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					))
				)}
			</div>
		</aside>
	);
}
