import { beforeEach, describe, expect, it, vi } from "vitest";
import { DBQueries } from "@/db/queries";
import { handleChatPost } from "@/routes/api/chat/-handlers";

const {
	getDBMock,
	loggedStreamTextMock,
	resolveToolsForAgentMock,
	resolveChatModelConfigMock,
	convertToModelMessagesMock,
} = vi.hoisted(() => ({
	getDBMock: vi.fn(),
	loggedStreamTextMock: vi.fn(),
	resolveToolsForAgentMock: vi.fn(),
	resolveChatModelConfigMock: vi.fn(),
	convertToModelMessagesMock: vi.fn(),
}));

vi.mock("@/server-functions/db", () => ({
	getDB: getDBMock,
}));

vi.mock("@/features/ai/core/logged-stream-text", () => ({
	loggedStreamText: loggedStreamTextMock,
}));

vi.mock("@/features/ai/tools/tool-resolver", () => ({
	resolveToolsForAgent: resolveToolsForAgentMock,
}));

vi.mock("@/lib/ai-config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/ai-config")>();
	return {
		...actual,
		resolveChatModelConfig: resolveChatModelConfigMock,
	};
});

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return {
		...actual,
		convertToModelMessages: convertToModelMessagesMock,
		createUIMessageStreamResponse: vi.fn(
			() =>
				new Response("stream", {
					status: 200,
					headers: { "Content-Type": "text/event-stream" },
				}),
		),
	};
});

vi.mock("@/lib/memory", () => ({
	MemoryManager: class {
		ensureStructure = vi.fn().mockResolvedValue(undefined);
		saveWebResearch = vi.fn().mockResolvedValue(undefined);
	},
}));

function createChatRequest(body: unknown): Request {
	return new Request("http://localhost/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

const validBody = {
	messages: [
		{
			id: "msg-1",
			role: "user",
			parts: [{ type: "text", text: "Hello" }],
		},
	],
};

describe("handleChatPost", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getDBMock.mockResolvedValue({});
		vi.spyOn(DBQueries.prototype, "getAllConfig").mockResolvedValue({});
		resolveChatModelConfigMock.mockResolvedValue({
			modelId: 1,
			model: "test-model",
			baseUrl: "https://example.com",
			apiKey: "secret",
			providerName: "test",
			thinkingEffortLevels: [],
			defaultThinkingEffort: null,
			requestParams: {},
		});
		resolveToolsForAgentMock.mockReturnValue({ tools: {} });
		convertToModelMessagesMock.mockResolvedValue([
			{ role: "user", content: "Hello" },
		]);
		loggedStreamTextMock.mockReturnValue({
			toUIMessageStream: vi.fn(() =>
				new ReadableStream({
					start(controller) {
						controller.close();
					},
				}),
			),
		});
	});

	it("returns 400 for invalid JSON", async () => {
		const response = await handleChatPost(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: "not-json",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Invalid chat request body");
	});

	it("returns 400 when messages are missing", async () => {
		const response = await handleChatPost(createChatRequest({ messages: [] }));
		expect(response.status).toBe(400);
		expect(await response.text()).toBe("messages are required");
	});

	it("returns 500 when D1 is unavailable", async () => {
		getDBMock.mockResolvedValue(null);

		const response = await handleChatPost(createChatRequest(validBody));
		expect(response.status).toBe(500);
		expect(await response.text()).toBe("D1 database not available");
	});

	it("returns 400 when AI is not configured", async () => {
		resolveChatModelConfigMock.mockResolvedValue(null);

		const response = await handleChatPost(createChatRequest(validBody));
		expect(response.status).toBe(400);
		expect(await response.text()).toBe("AI provider not configured");
	});

	it("streams a response when configuration is valid", async () => {
		const response = await handleChatPost(createChatRequest(validBody));

		expect(response.status).toBe(200);
		expect(loggedStreamTextMock).toHaveBeenCalledTimes(1);
		expect(resolveChatModelConfigMock).toHaveBeenCalledWith(
			expect.any(DBQueries),
			null,
		);
	});

	it("passes requested modelId to resolveChatModelConfig", async () => {
		await handleChatPost(
			createChatRequest({
				...validBody,
				modelId: 9,
			}),
		);

		expect(resolveChatModelConfigMock).toHaveBeenCalledWith(
			expect.any(DBQueries),
			9,
		);
	});

	it("includes pageContext in the chat system prompt", async () => {
		await handleChatPost(
			createChatRequest({
				...validBody,
				metadata: {
					pageContext: {
						contextKey: "exam:7",
						pageType: "exam",
						label: "Prova 7",
						route: "/exams/7",
						examId: "7",
					},
				},
			}),
		);

		expect(loggedStreamTextMock).toHaveBeenCalledTimes(1);
		const callArgs = loggedStreamTextMock.mock.calls[0];
		expect(callArgs?.[1]?.system).toContain("Prova 7");
		expect(callArgs?.[1]?.system).toContain("Exam ID: 7");
	});
});
