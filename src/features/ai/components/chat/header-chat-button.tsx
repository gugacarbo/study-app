import { useSelector } from "@tanstack/react-store";
import { AlertCircle, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePageChatContext } from "@/features/ai/context/page-chat-context";
import {
	getLayoutUIStore,
	toggleHeaderChatOpen,
} from "@/features/ai/stores/ui-store";
import { cn } from "@/lib/utils";

export function HeaderChatButton() {
	const pageContext = usePageChatContext();
	const { headerChatOpen, headerChatStreaming, headerChatError } = useSelector(
		getLayoutUIStore(),
		(s) => ({
			headerChatOpen: s.headerChatOpen,
			headerChatStreaming: s.headerChatStreaming,
			headerChatError: s.headerChatError,
		}),
	);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant={headerChatOpen ? "secondary" : "ghost"}
					size="icon"
					className="relative size-9"
					aria-label="Abrir chat"
					aria-pressed={headerChatOpen}
					onClick={() => toggleHeaderChatOpen()}
				>
					<MessageCircle className="size-4" />
					{headerChatStreaming ? (
						<span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary">
							<Loader2 className="size-2.5 animate-spin text-primary-foreground" />
						</span>
					) : null}
					{headerChatError && !headerChatStreaming ? (
						<span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive">
							<AlertCircle className="size-2.5 text-destructive-foreground" />
						</span>
					) : null}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<p className="font-medium">Chat</p>
				<p className="text-muted-foreground">{pageContext.label}</p>
				<p className="text-muted-foreground text-[10px]">Ctrl/Cmd+Shift+C</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function HeaderChatContextBadge({ className }: { className?: string }) {
	const pageContext = usePageChatContext();

	return (
		<span
			className={cn(
				"inline-flex max-w-[180px] truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
				className,
			)}
			title={pageContext.label}
		>
			{pageContext.label}
		</span>
	);
}
