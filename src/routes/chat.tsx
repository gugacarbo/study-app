import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Chat } from "@/features/ai/components/chat/chat";
import {
	conversationsStore,
	setActiveConversation,
} from "@/features/ai/stores/conversations-store";

export const Route = createFileRoute("/chat")({
	validateSearch: (search: Record<string, unknown>) => ({
		conversation:
			typeof search.conversation === "string" ? search.conversation : undefined,
	}),
	component: ChatPage,
});

function ChatPage() {
	const { conversation } = Route.useSearch();

	useEffect(() => {
		if (!conversation) return;
		if (conversationsStore.state.activeId === conversation) return;
		void setActiveConversation(conversation);
	}, [conversation]);

	return <Chat />;
}
