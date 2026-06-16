import type { UIMessage } from "ai";

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
