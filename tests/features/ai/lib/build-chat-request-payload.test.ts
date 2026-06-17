import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { buildChatRequestPayload } from "@/features/ai/lib/build-chat-request-payload";

const userMessage = {
	id: "u1",
	role: "user",
	parts: [{ type: "text", text: "Hello" }],
} as UIMessage;

describe("buildChatRequestPayload", () => {
	it("builds the POST body shape used by /api/chat", () => {
		expect(
			buildChatRequestPayload({
				messages: [userMessage],
				conversationId: "conv-1",
				reviewMode: true,
				modelId: 9,
				pageContext: {
					contextKey: "exam:7",
					pageType: "exam",
					label: "Prova 7",
					route: "/exams/7",
					examId: "7",
				},
				clientTools: {
					scroll_to_question: {
						description: "Scroll",
						parameters: { type: "object", properties: {} },
					},
				},
			}),
		).toEqual({
			messages: [userMessage],
			reviewMode: true,
			conversationId: "conv-1",
			modelId: 9,
			metadata: {
				pageContext: {
					contextKey: "exam:7",
					pageType: "exam",
					label: "Prova 7",
					route: "/exams/7",
					examId: "7",
				},
			},
			tools: {
				scroll_to_question: {
					description: "Scroll",
					parameters: { type: "object", properties: {} },
				},
			},
		});
	});

	it("returns null when there are no exportable messages", () => {
		expect(
			buildChatRequestPayload({
				messages: [
					{
						id: "welcome",
						role: "assistant",
						parts: [{ type: "text", text: "Hi" }],
					} as UIMessage,
				],
				conversationId: "conv-1",
				reviewMode: false,
			}),
		).toBeNull();
	});
});
