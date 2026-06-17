import { useAuiState } from "@assistant-ui/react";
import type { MessageTiming } from "@assistant-ui/core";
import { type MutableRefObject, useEffect } from "react";

export function ChatMessagePerfCache({
	cacheRef,
}: {
	cacheRef: MutableRefObject<Record<string, MessageTiming>>;
}) {
	const messages = useAuiState((state) => state.thread.messages);

	useEffect(() => {
		const next = { ...cacheRef.current };

		for (const message of messages) {
			if (message.role !== "assistant") continue;
			const timing = message.metadata.timing;
			if (timing) {
				next[message.id] = timing;
			}
		}

		cacheRef.current = next;
	}, [messages, cacheRef]);

	return null;
}
