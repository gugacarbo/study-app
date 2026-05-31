export interface PerfRuntime {
	startedAt: number;
	firstTokenAt: number | null;
}

export const WELCOME = {
	id: "welcome",
	role: "assistant" as const,
	parts: [
		{
			type: "text" as const,
			content:
				"Hi! I'm your study assistant. Ask me anything about your subjects.",
		},
	],
};

export function getMessageText(message: {
	parts: Array<{ type: string; content?: string }>;
}): string {
	return message.parts
		.filter((part) => part.type === "text" || part.type === "thinking")
		.map((part) => part.content ?? "")
		.join("");
}

export function estimateTokens(text: string): number {
	const clean = text.trim();
	if (!clean) return 0;
	return Math.max(1, Math.round(clean.length / 4));
}
