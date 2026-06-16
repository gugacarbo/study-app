import { describe, expect, it } from "vitest";
import { toIngestJobViewModel } from "@/routes/exams.upload";
import type { IngestJob } from "@/features/ingest/store";

function createJob(overrides?: Partial<IngestJob>): IngestJob {
	return {
		id: "job-1",
		fileName: "exam.txt",
		status: "running",
		createdAt: 1,
		startedAt: 2,
		finishedAt: null,
		stepText: "Running review",
		logs: [],
		outputEntries: [],
		agentRuns: [],
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		nonAgentTokenTotals: { prompt: 0, completion: 0, total: 0 },
		warnings: [],
		result: null,
		error: null,
		stages: [
			{
				stageId: "review",
				label: "Review",
				status: "running",
				timestamp: 3,
			},
		],
		buffer: [],
		enableReview: true,
		enableExplanations: false,
		agentConcurrency: 10,
		rawStreamText: "",
		...overrides,
	};
}

describe("toIngestJobViewModel", () => {
	it("coalesces adjacent chunk output entries into a single assistant message", () => {
		const job = createJob({
			outputEntries: [
				{
					id: "chunk-1",
					stageId: "review",
					agentRunId: "review-1",
					kind: "chunk",
					text: '{"question":"A',
					timestamp: 10,
				},
				{
					id: "chunk-2",
					stageId: "review",
					agentRunId: "review-1",
					kind: "chunk",
					text: 'nswer"}',
					timestamp: 11,
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.outputEntries).toHaveLength(1);
		expect(viewModel.outputEntries[0]).toMatchObject({
			kind: "message",
			role: "assistant",
			content: '{"question":"Answer"}',
		});
	});

	it("uses agent raw output as response fallback when no streamed output text exists", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-1",
					stageId: "review",
					label: "Reviewer Q1",
					status: "done",
					timestamp: 20,
					messages: [],
					systemPrompt: "system",
					userPrompt: "user",
					outputText: "",
					rawOutput: '{"answer":"42"}',
					error: null,
					warnings: [],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents).toHaveLength(1);
		expect(viewModel.agents[0]).toMatchObject({
			name: "Reviewer Q1",
			response: '{"answer":"42"}',
		});
	});

	it("falls back to JSON.stringify(rawOutput) when rawOutput is an object", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-2",
					stageId: "review",
					label: "Reviewer Q2",
					status: "done",
					timestamp: 20,
					messages: [],
					systemPrompt: "system",
					userPrompt: "user",
					outputText: "",
					rawOutput: { answer: "99", confidence: 0.95 },
					error: null,
					warnings: [],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents).toHaveLength(1);
		expect(viewModel.agents[0]).toMatchObject({
			name: "Reviewer Q2",
			response: '{\n  "answer": "99",\n  "confidence": 0.95\n}',
		});
	});

	it("uses outputText as response when available, before rawOutput fallback", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-3",
					stageId: "review",
					label: "Reviewer Q3",
					status: "done",
					timestamp: 20,
					messages: [],
					systemPrompt: "system",
					userPrompt: "user",
					outputText: "streamed output text",
					rawOutput: '{"ignored":"42"}',
					error: null,
					warnings: [],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents).toHaveLength(1);
		expect(viewModel.agents[0]).toMatchObject({
			name: "Reviewer Q3",
			response: "streamed output text",
		});
	});

	it("preserves structured agent messages and tool parts in the view model", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-structured",
					stageId: "review",
					label: "Reviewer Structured",
					status: "done",
					timestamp: 20,
					messages: [
						{
							id: "review-structured:system",
							role: "system",
							parts: [{ type: "text", text: "system prompt" }],
						},
						{
							id: "review-structured:user",
							role: "user",
							parts: [{ type: "text", text: "user prompt" }],
						},
						{
							id: "review-structured:assistant",
							role: "assistant",
							parts: [
								{ type: "text", text: "assistant text" },
								{
									type: "dynamic-tool",
									toolCallId: "review-structured:tool-call:0",
									toolName: "search_docs",
									state: "output-available",
									input: { query: "ingest" },
									output: { ok: true },
								},
							],
						},
					],
					systemPrompt: "system prompt",
					userPrompt: "user prompt",
					outputText: "assistant text",
					rawOutput: null,
					error: null,
					warnings: [],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents[0]?.messages).toEqual(job.agentRuns[0]?.messages);
		expect(viewModel.agents[0]).toMatchObject({
			systemPrompt: "system prompt",
			userPrompt: "user prompt",
			response: "assistant text",
		});
	});

	it("builds fallback messages for legacy agent runs without messages", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-legacy",
					stageId: "review",
					label: "Reviewer Legacy",
					status: "done",
					timestamp: 20,
					messages: [],
					systemPrompt: "legacy system",
					userPrompt: "legacy user",
					outputText: "",
					rawOutput: { answer: "42" },
					error: null,
					warnings: [],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents[0]?.messages).toEqual([
			{
				id: "review-legacy:system",
				role: "system",
				parts: [{ type: "text", text: "legacy system" }],
			},
			{
				id: "review-legacy:user",
				role: "user",
				parts: [{ type: "text", text: "legacy user" }],
			},
			{
				id: "review-legacy:assistant",
				role: "assistant",
				parts: [
					{
						type: "text",
						text: '{\n  "answer": "42"\n}',
					},
				],
			},
		]);
	});

	it("preserves friendly agent label after warning is attached", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-4",
					stageId: "review",
					label: "Reviewer Q4",
					status: "warning",
					timestamp: 20,
					messages: [],
					systemPrompt: "system",
					userPrompt: "user",
					outputText: "",
					rawOutput: null,
					error: null,
					warnings: ["low confidence"],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents).toHaveLength(1);
		expect(viewModel.agents[0]).toMatchObject({
			name: "Reviewer Q4",
			state: "warning",
		});
	});

	it("preserves error state on agent even when warnings are present", () => {
		const job = createJob({
			agentRuns: [
				{
					id: "review-5",
					stageId: "review",
					label: "Reviewer Q5",
					status: "error",
					timestamp: 20,
					messages: [],
					systemPrompt: "system",
					userPrompt: "user",
					outputText: "",
					rawOutput: null,
					error: "Review failed",
					warnings: ["low confidence", "retry suggested"],
					tokenTotals: { prompt: 1, completion: 2, total: 3 },
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.agents).toHaveLength(1);
		expect(viewModel.agents[0]).toMatchObject({
			name: "Reviewer Q5",
			state: "error",
		});
	});

	it("coalesces only adjacent messages with matching role, stageId, label, and status", () => {
		const job = createJob({
			outputEntries: [
				{
					id: "chunk-1",
					stageId: "review",
					agentRunId: "agent-1",
					kind: "chunk",
					text: "Hello",
					timestamp: 10,
				},
				{
					id: "chunk-2",
					stageId: "review",
					agentRunId: "agent-2",
					kind: "chunk",
					text: "World",
					timestamp: 11,
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.outputEntries).toHaveLength(2);

		const msg1 = viewModel.outputEntries[0];
		expect(msg1.kind).toBe("message");
		if (msg1.kind === "message") expect(msg1.content).toBe("Hello");

		const msg2 = viewModel.outputEntries[1];
		expect(msg2.kind).toBe("message");
		if (msg2.kind === "message") expect(msg2.content).toBe("World");
	});

	it("does not coalesce messages with different status", () => {
		const job = createJob({
			outputEntries: [
				{
					id: "chunk-1",
					stageId: "review",
					agentRunId: "agent-1",
					kind: "chunk",
					text: "A",
					timestamp: 10,
				},
				{
					id: "warn-1",
					stageId: "review",
					agentRunId: "agent-1",
					kind: "warning",
					text: "B",
					timestamp: 11,
				},
			],
		});

		const viewModel = toIngestJobViewModel(job);

		expect(viewModel.outputEntries).toHaveLength(2);
	});
});
