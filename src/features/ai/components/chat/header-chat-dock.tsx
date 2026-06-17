import { useRouterState } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { ExpandedChatSheet } from "@/features/ai/components/chat/expanded-chat-sheet";
import { getLayoutUIStore } from "@/features/ai/stores/ui-store";

export const HEADER_CHAT_DOCK_WIDTH_PX = 600;

export function HeaderChatDock() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { headerChatOpen, headerChatView } = useSelector(
		getLayoutUIStore(),
		(s) => ({
			headerChatOpen: s.headerChatOpen,
			headerChatView: s.headerChatView,
		}),
	);

	if (pathname === "/chat" || !headerChatOpen || headerChatView !== "sheet") {
		return null;
	}

	return (
		<aside
			className="flex h-full shrink-0 flex-col overflow-hidden border-l bg-popover"
			style={{ width: HEADER_CHAT_DOCK_WIDTH_PX }}
			aria-label="Chat expandido"
		>
			<ExpandedChatSheet />
		</aside>
	);
}
