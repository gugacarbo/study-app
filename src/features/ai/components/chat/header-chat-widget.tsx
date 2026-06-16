import { useSelector } from "@tanstack/react-store";
import { useEffect } from "react";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { HeaderChatButton } from "@/features/ai/components/chat/header-chat-button";
import { CompactChatPanel } from "@/features/ai/components/chat/compact-chat-panel";
import { ExpandedChatSheet } from "@/features/ai/components/chat/expanded-chat-sheet";
import {
	getLayoutUIStore,
	setHeaderChatOpen,
	setHeaderChatStreaming,
} from "@/features/ai/stores/ui-store";

export function HeaderChatWidget() {
	const { headerChatOpen, headerChatView } = useSelector(
		getLayoutUIStore(),
		(s) => ({
			headerChatOpen: s.headerChatOpen,
			headerChatView: s.headerChatView,
		}),
	);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
			if (event.key.toLowerCase() !== "c") return;
			event.preventDefault();
			setHeaderChatOpen(!getLayoutUIStore().state.headerChatOpen);
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		if (!headerChatOpen) {
			setHeaderChatStreaming(false);
		}
	}, [headerChatOpen]);

	return (
		<>
			<Popover
				open={headerChatOpen && headerChatView === "popover"}
				onOpenChange={(open) => {
					if (headerChatView === "popover") setHeaderChatOpen(open);
				}}
			>
				<PopoverAnchor asChild>
					<div className="inline-flex">
						<HeaderChatButton />
					</div>
				</PopoverAnchor>
				<PopoverContent
					align="end"
					side="bottom"
					sideOffset={8}
					className="flex h-[520px] w-[380px] flex-col overflow-hidden p-0"
				>
					<CompactChatPanel />
				</PopoverContent>
			</Popover>

			{headerChatView === "sheet" ? (
				<Sheet
					modal={false}
					open={headerChatOpen}
					onOpenChange={(open) => {
						if (open) setHeaderChatOpen(true);
					}}
				>
					<SheetContent
						side="right"
						className="flex w-[600px] max-w-[600px] flex-col overflow-hidden p-0 sm:max-w-[600px]"
						showCloseButton={false}
						showOverlay={false}
						onInteractOutside={(event) => event.preventDefault()}
						onPointerDownOutside={(event) => event.preventDefault()}
					>
						<SheetHeader className="sr-only">
							<SheetTitle>Chat expandido</SheetTitle>
							<SheetDescription>
								Painel de chat expandido na lateral da página.
							</SheetDescription>
						</SheetHeader>
						<ExpandedChatSheet />
					</SheetContent>
				</Sheet>
			) : null}
		</>
	);
}
