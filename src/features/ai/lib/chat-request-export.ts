import type { ChatRequestExportPayload } from "@/features/ai/lib/build-chat-request-payload";

type ChatRequestExportGetter = () => ChatRequestExportPayload | null;

let activeGetter: ChatRequestExportGetter | null = null;

export function setChatRequestExportGetter(getter: ChatRequestExportGetter | null) {
	activeGetter = getter;
}

export function getChatRequestExportPayload(): ChatRequestExportPayload | null {
	return activeGetter?.() ?? null;
}
