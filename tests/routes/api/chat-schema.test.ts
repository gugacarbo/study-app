import { describe, expect, it } from "vitest";
import {
	parseChatRequest,
	parseClientToolsFromRequest,
	readModelId,
	resolveChatModelId,
} from "@/routes/api/chat/-schema";

describe("resolveChatModelId", () => {
	it("returns null when modelId is missing", () => {
		expect(resolveChatModelId({})).toBeNull();
	});

	it("returns null for invalid nested values", () => {
		expect(resolveChatModelId({ forwardedProps: { modelId: "1" } })).toBeNull();
		expect(resolveChatModelId({ metadata: { modelId: null } })).toBeNull();
	});

	it("reads modelId from body", () => {
		expect(resolveChatModelId({ modelId: 7 })).toBe(7);
	});

	it("reads modelId from forwardedProps when body is missing", () => {
		expect(resolveChatModelId({ forwardedProps: { modelId: 12 } })).toBe(12);
	});

	it("reads modelId from metadata as fallback", () => {
		expect(resolveChatModelId({ metadata: { modelId: 42 } })).toBe(42);
	});

	it("prefers body modelId over forwardedProps and metadata", () => {
		expect(
			resolveChatModelId({
				modelId: 1,
				forwardedProps: { modelId: 2 },
				metadata: { modelId: 3 },
			}),
		).toBe(1);
	});
});

describe("readModelId", () => {
	it("returns null for non-numeric values", () => {
		expect(readModelId({ modelId: "1" })).toBeNull();
		expect(readModelId({ modelId: 0 })).toBeNull();
		expect(readModelId({ modelId: -1 })).toBeNull();
	});
});

describe("parseChatRequest", () => {
	const validMessage = {
		id: "msg-1",
		role: "user" as const,
		parts: [{ type: "text", text: "Hello" }],
	};

	it("rejects non-object payloads", () => {
		const result = parseChatRequest(null);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
		}
	});

	it("rejects empty messages with plain text response", async () => {
		const result = parseChatRequest({ messages: [] });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
			expect(await result.response.text()).toBe("messages are required");
		}
	});

	it("parses a valid request and coalesces reviewMode and modelId", () => {
		const result = parseChatRequest({
			messages: [validMessage],
			forwardedProps: { reviewMode: "true", modelId: 5 },
			conversationId: "conv_123",
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.reviewMode).toBe(true);
			expect(result.data.modelId).toBe(5);
			expect(result.data.conversationId).toBe("conv_123");
			expect(result.data.messages).toHaveLength(1);
		}
	});

	it("returns JSON details for malformed messages", async () => {
		const result = parseChatRequest({
			messages: [{ role: "user" }],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
			const body = (await result.response.json()) as {
				error: string;
				details: Array<{ path: string; message: string }>;
			};
			expect(body.error).toBe("Invalid chat request");
			expect(body.details).toEqual(expect.any(Array));
		}
	});
});

describe("parseClientToolsFromRequest", () => {
	it("normalizes array tools into a record", () => {
		const parsed = parseClientToolsFromRequest({
			tools: [
				{
					name: "my_tool",
					description: "demo",
					parameters: { type: "object", properties: {} },
				},
			],
		});

		expect(parsed.my_tool).toEqual({
			description: "demo",
			parameters: { type: "object", properties: {} },
		});
	});
});
