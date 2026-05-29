import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/stores/conversationsStore";
import { CardHeader, CardTitle } from "../ui/card";

interface ChatHeaderProps {
	activeId: string | null;
	conversations: Conversation[];
	editingTitle: boolean;
	titleDraft: string;
	onStartEditing: () => void;
	onSaveTitle: () => void;
	onCancelEditing: () => void;
	onTitleDraftChange: (value: string) => void;
}

export function ChatHeader({
	activeId,
	conversations,
	editingTitle,
	titleDraft,
	onStartEditing,
	onSaveTitle,
	onCancelEditing,
	onTitleDraftChange,
}: ChatHeaderProps) {
	return (
		<CardHeader className="flex shrink-0 items-center justify-between border-b border-border/60 py-3">
			<div className="flex items-center gap-2">
				<CardTitle className="text-2xl font-bold">Chat</CardTitle>
			</div>
			{activeId &&
				conversations.length > 0 &&
				(editingTitle ? (
					<Input
						value={titleDraft}
						onChange={(e) => onTitleDraftChange(e.target.value)}
						onBlur={onSaveTitle}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								onSaveTitle();
							}
							if (e.key === "Escape") {
								onCancelEditing();
							}
						}}
						autoFocus
						className="h-7 w-64 text-sm"
					/>
				) : (
					<Button
						variant="link"
						onClick={onStartEditing}
						className="text-sm text-muted-foreground hover:text-foreground cursor-text h-auto px-0 font-normal no-underline"
					>
						{conversations.find((c) => c.id === activeId)?.title ?? "Chat"}
					</Button>
				))}
		</CardHeader>
	);
}
