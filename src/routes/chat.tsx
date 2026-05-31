import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "@/features/ai/components/chat/chat";

export const Route = createFileRoute("/chat")({
	component: ChatPage,
});

function ChatPage() {
	return <Chat />;
}
