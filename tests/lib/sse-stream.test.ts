import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ingestStream,
	type IngestAgentEvent,
	type IngestChunkEvent,
	type IngestStageEvent,
	type IngestTokenEvent,
	type IngestWarningEvent,
} from "@/lib/sse-stream";

function createSseResponse(events: Array<{ event: string; data: unknown }>) {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const item of events) {
				const payload = `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`;
				controller.enqueue(encoder.encode(payload));
			}
			controller.close();
		},
	});

	return new Response(body, {
		headers: { "Content-Type": "text/event-stream" },
	});
}

describe("ingestStream", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses structured ingest stage, chunk, warning, token, and agent events", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			createSseResponse([
				{ event: "progress", data: { step: "Running review..." } },
				{
					event: "stage",
					data: {
						stageId: "review",
						label: "Review",
						status: "running",
						timestamp: 111,
					},
				},
				{
					event: "agent",
					data: {
						agentRunId: "review_q1",
						stageId: "review",
						label: "Question 1 reviewer",
						status: "running",
						timestamp: 112,
						systemPrompt: "system",
						userPrompt: "user",
					},
				},
				{
					event: "chunk",
					data: {
						stageId: "review",
						agentRunId: "review_q1",
						text: "delta",
						timestamp: 113,
					},
				},
				{
					event: "warning",
					data: {
						stageId: "review",
						agentRunId: "review_q1",
						message: "careful",
						timestamp: 114,
					},
				},
				{
					event: "token",
					data: {
						stageId: "review",
						agentRunId: "review_q1",
						usage: {
							promptTokens: 10,
							completionTokens: 20,
							totalTokens: 30,
						},
						timestamp: 115,
					},
				},
				{
					event: "result",
					data: {
						questions: 4,
						topics: ["A"],
						examId: 1,
						fileId: 2,
					},
				},
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const steps: string[] = [];
		const chunks: IngestChunkEvent[] = [];
		const warnings: IngestWarningEvent[] = [];
		const tokens: IngestTokenEvent[] = [];
		const stages: IngestStageEvent[] = [];
		const agents: IngestAgentEvent[] = [];

		const result = await ingestStream(
			{
				buffer: [1, 2, 3],
				fileName: "exam.txt",
				config: {
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "key",
					baseUrl: "",
				},
			},
			{
				onStep: (step) => {
					steps.push(step);
				},
				onChunk: (_text, event) => {
					if (event) {
						chunks.push(event);
					}
				},
				onWarning: (_message, event) => {
					if (event) {
						warnings.push(event);
					}
				},
				onToken: (_prompt, _completion, _total, event) => {
					if (event) {
						tokens.push(event);
					}
				},
				onStage: (stage) => {
					stages.push(stage);
				},
				onAgent: (event) => {
					agents.push(event);
				},
			},
		);

		expect(result).toEqual({
			questions: 4,
			topics: ["A"],
			examId: 1,
			fileId: 2,
		});
		expect(steps).toEqual([
			"Running review...",
			"Warning: careful",
		]);
		expect(stages).toEqual([
			{
				stageId: "review",
				label: "Review",
				status: "running",
				timestamp: 111,
				meta: undefined,
			},
		]);
		expect(agents).toEqual([
			{
				eventType: undefined,
				agentRunId: "review_q1",
				stageId: "review",
				label: "Question 1 reviewer",
				status: "running",
				state: undefined,
				timestamp: 112,
				systemPrompt: "system",
				userPrompt: "user",
				rawText: undefined,
				finalObject: undefined,
				error: undefined,
				warning: undefined,
				tokens: undefined,
				meta: undefined,
				name: undefined,
				arguments: undefined,
				input: undefined,
				output: undefined,
				content: undefined,
			},
		]);
		expect(chunks).toEqual([
			{
				stageId: "review",
				agentRunId: "review_q1",
				text: "delta",
				timestamp: 113,
			},
		]);
		expect(warnings).toEqual([
			{
				message: "careful",
				stageId: "review",
				agentRunId: "review_q1",
				timestamp: 114,
			},
		]);
		expect(tokens).toEqual([
			{
				prompt: 10,
				completion: 20,
				total: 30,
				stageId: "review",
				agentRunId: "review_q1",
				timestamp: 115,
			},
		]);
	});

	it("parses token events with usage.promptTokens, usage.completionTokens, and usage.totalTokens", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			createSseResponse([
				{
					event: "token",
					data: {
						stageId: "extract",
						agentRunId: "extract-1",
						usage: {
							promptTokens: 50,
							completionTokens: 150,
							totalTokens: 200,
						},
						timestamp: 1,
					},
				},
				{
					event: "result",
					data: { questions: 1, topics: ["T"], examId: 1, fileId: 1 },
				},
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const tokens: IngestTokenEvent[] = [];
		await ingestStream(
			{
				buffer: [1],
				fileName: "exam.txt",
				config: {
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "key",
					baseUrl: "",
				},
			},
			{
				onStep: () => {},
				onToken: (_p, _c, _t, event) => {
					if (event) tokens.push(event);
				},
			},
		);

		expect(tokens).toEqual([
			{
				prompt: 50,
				completion: 150,
				total: 200,
				stageId: "extract",
				agentRunId: "extract-1",
				timestamp: 1,
			},
		]);
	});

	it("preserves stageId and agentRunId on agent, warning, and token events for reviewer metadata", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			createSseResponse([
				{
					event: "stage",
					data: {
						stageId: "review",
						label: "Review",
						status: "running",
						timestamp: 1,
					},
				},
				{
					event: "agent",
					data: {
						agentRunId: "reviewer-3",
						stageId: "review",
						label: "Reviewer Q3",
						status: "running",
						timestamp: 2,
					},
				},
				{
					event: "warning",
					data: {
						message: "low confidence",
						stageId: "review",
						agentRunId: "reviewer-3",
						timestamp: 3,
					},
				},
				{
					event: "token",
					data: {
						prompt: 5,
						completion: 15,
						total: 20,
						stageId: "review",
						agentRunId: "reviewer-3",
						timestamp: 4,
					},
				},
				{
					event: "agent",
					data: {
						agentRunId: "reviewer-3",
						stageId: "review",
						label: "Reviewer Q3",
						status: "done",
						timestamp: 5,
					},
				},
				{
					event: "result",
					data: { questions: 1, topics: ["T"], examId: 1, fileId: 1 },
				},
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const agents: IngestAgentEvent[] = [];
		const warnings: IngestWarningEvent[] = [];
		const tokens: IngestTokenEvent[] = [];

		await ingestStream(
			{
				buffer: [1],
				fileName: "exam.txt",
				config: {
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "key",
					baseUrl: "",
				},
			},
			{
				onStep: () => {},
				onAgent: (event) => agents.push(event),
				onWarning: (_msg, event) => {
					if (event) warnings.push(event);
				},
				onToken: (_p, _c, _t, event) => {
					if (event) tokens.push(event);
				},
			},
		);

		expect(agents).toHaveLength(2);
		expect(agents[0]).toMatchObject({
			agentRunId: "reviewer-3",
			stageId: "review",
			status: "running",
		});
		expect(agents[1]).toMatchObject({
			agentRunId: "reviewer-3",
			stageId: "review",
			status: "done",
		});

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			message: "low confidence",
			stageId: "review",
			agentRunId: "reviewer-3",
		});

		expect(tokens).toHaveLength(1);
		expect(tokens[0]).toMatchObject({
			stageId: "review",
			agentRunId: "reviewer-3",
		});
	});

	it("parses agent tool-call and tool-result payloads without changing the SSE contract", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			createSseResponse([
				{
					event: "agent",
					data: {
						eventType: "tool-call",
						agentRunId: "reviewer-4",
						stageId: "review",
						label: "Reviewer Q4",
						name: "web_search",
						arguments: '{"query":"cache memory"}',
						input: { query: "cache memory" },
						output: { ok: true },
						state: "complete",
						timestamp: 10,
					},
				},
				{
					event: "agent",
					data: {
						eventType: "tool-result",
						agentRunId: "reviewer-4",
						stageId: "review",
						label: "Reviewer Q4",
						content: { ok: true },
						state: "complete",
						timestamp: 11,
					},
				},
				{
					event: "result",
					data: { questions: 1, topics: ["T"], examId: 1, fileId: 1 },
				},
			]),
		);
		vi.stubGlobal("fetch", fetchMock);

		const agents: IngestAgentEvent[] = [];

		await ingestStream(
			{
				buffer: [1],
				fileName: "exam.txt",
				config: {
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "key",
					baseUrl: "",
				},
			},
			{
				onStep: () => {},
				onToken: () => {},
				onAgent: (event) => agents.push(event),
			},
		);

		expect(agents).toEqual([
			{
				eventType: "tool-call",
				agentRunId: "reviewer-4",
				stageId: "review",
				label: "Reviewer Q4",
				status: undefined,
				state: "complete",
				timestamp: 10,
				systemPrompt: undefined,
				userPrompt: undefined,
				rawText: undefined,
				finalObject: undefined,
				error: undefined,
				warning: undefined,
				tokens: undefined,
				meta: undefined,
				name: "web_search",
				arguments: '{"query":"cache memory"}',
				input: { query: "cache memory" },
				output: { ok: true },
				content: undefined,
			},
			{
				eventType: "tool-result",
				agentRunId: "reviewer-4",
				stageId: "review",
				label: "Reviewer Q4",
				status: undefined,
				state: "complete",
				timestamp: 11,
				systemPrompt: undefined,
				userPrompt: undefined,
				rawText: undefined,
				finalObject: undefined,
				error: undefined,
				warning: undefined,
				tokens: undefined,
				meta: undefined,
				name: undefined,
				arguments: undefined,
				input: undefined,
				output: undefined,
				content: { ok: true },
			},
		]);
	});
});
