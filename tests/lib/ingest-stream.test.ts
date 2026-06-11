import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestStream } from "@/lib/sse-stream/ingest-stream";

function createSseResponse(blocks: string[]): Response {
	const encoder = new TextEncoder();
	const body = new ReadableStream({
		start(controller) {
			for (const block of blocks) {
				controller.enqueue(encoder.encode(block));
			}
			controller.close();
		},
	});

	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
}

describe("ingestStream", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses tool-call and tool-result agent payloads without breaking legacy agent events", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			createSseResponse([
				'event: agent\ndata: {"eventType":"lifecycle","agentRunId":"agent-1","stageId":"review","label":"Reviewer","status":"running","systemPrompt":"system","userPrompt":"user"}\n\n',
				'event: agent\ndata: {"eventType":"tool-call","agentRunId":"agent-1","stageId":"review","label":"Reviewer","name":"search_docs","arguments":"{\\"query\\":\\"ingest\\"}","input":{"query":"ingest"},"state":"input-complete"}\n\n',
				'event: agent\ndata: {"eventType":"tool-result","agentRunId":"agent-1","stageId":"review","label":"Reviewer","content":{"ok":true},"state":"complete"}\n\n',
				'event: result\ndata: {"questions":1,"topics":["math"]}\n\n',
			]),
		);

		const agentEvents: unknown[] = [];
		const result = await ingestStream(
			{
				buffer: [1, 2, 3],
				fileName: "exam.pdf",
			},
			{
				onStep: vi.fn(),
				onToken: vi.fn(),
				onAgent: (event) => agentEvents.push(event),
			},
		);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(agentEvents).toEqual([
			expect.objectContaining({
				eventType: "lifecycle",
				systemPrompt: "system",
				userPrompt: "user",
			}),
			expect.objectContaining({
				eventType: "tool-call",
				name: "search_docs",
				arguments: '{"query":"ingest"}',
				input: { query: "ingest" },
				state: "input-complete",
			}),
			expect.objectContaining({
				eventType: "tool-result",
				content: { ok: true },
				state: "complete",
			}),
		]);
		expect(result).toEqual({ questions: 1, topics: ["math"] });
	});
});
