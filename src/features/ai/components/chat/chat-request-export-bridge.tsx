import { useEffect, useRef } from "react";
import type { PageChatContextPayload } from "@/features/ai/context/page-chat-context";
import { buildChatRequestPayload } from "@/features/ai/lib/build-chat-request-payload";
import { setChatRequestExportGetter } from "@/features/ai/lib/chat-request-export";
import type { ParsedClientTools } from "@/routes/api/chat/-schema";
import { getConversationMessages } from "@/features/ai/stores/conversations-store";

interface ChatRequestExportBridgeProps {
	conversationId: string;
	reviewMode: boolean;
	modelId?: number;
	pageContext?: PageChatContextPayload | null;
	clientTools?: ParsedClientTools;
}

export function ChatRequestExportBridge({
	conversationId,
	reviewMode,
	modelId,
	pageContext = null,
	clientTools,
}: ChatRequestExportBridgeProps) {
	const conversationIdRef = useRef(conversationId);
	conversationIdRef.current = conversationId;

	const reviewModeRef = useRef(reviewMode);
	reviewModeRef.current = reviewMode;

	const modelIdRef = useRef(modelId);
	modelIdRef.current = modelId;

	const pageContextRef = useRef(pageContext);
	pageContextRef.current = pageContext;

	const clientToolsRef = useRef(clientTools);
	clientToolsRef.current = clientTools;

	useEffect(() => {
		setChatRequestExportGetter(() =>
			buildChatRequestPayload({
				messages: getConversationMessages(conversationIdRef.current),
				conversationId: conversationIdRef.current,
				reviewMode: reviewModeRef.current,
				modelId: modelIdRef.current,
				pageContext: pageContextRef.current,
				clientTools: clientToolsRef.current,
			}),
		);

		return () => setChatRequestExportGetter(null);
	}, [conversationId]);

	return null;
}
