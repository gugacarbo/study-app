import { useEffect } from "react";
import type { UIMessage } from "@tanstack/ai-client";
import type { Conversation } from "@/stores/conversationsStore";
import { updateConversationTitle } from "@/stores/conversationsStore";

export function useAutoTitle(
	activeId: string | null,
	messages: UIMessage[],
	conversations: Conversation[],
) {
	useEffect(() => {
		if (!activeId) return;
		const conv = conversations.find((c) => c.id === activeId);
		if (conv?.title !== "New Chat") return;
		const text =
			messages
				.find((m) => m.role === "user")
				?.parts.find((p) => p.type === "text")?.content ?? "";
		if (text)
			updateConversationTitle(
				activeId,
				text.length > 50 ? `${text.slice(0, 47)}...` : text,
			);
	}, [messages, activeId, conversations]);
}
