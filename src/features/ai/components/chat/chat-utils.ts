import type { UIMessage } from "ai";

export interface PerfRuntime {
	startedAt: number;
	firstTokenAt: number | null;
}

export const WELCOME: UIMessage = {
	id: "welcome",
	role: "assistant",
	parts: [
		{
			type: "text",
			text: "Hi! I'm your study assistant. Ask me anything about your subjects.",
		},
	],
};

export function getMessageText(message: UIMessage): string {
	return message.parts
		.filter((part) => part.type === "text" || part.type === "reasoning")
		.map((part) => ("text" in part ? part.text : ""))
		.join("");
}

export function estimateTokens(text: string): number {
	const clean = text.trim();
	if (!clean) return 0;
	return Math.max(1, Math.round(clean.length / 4));
}
