import { describe, expect, it } from "vitest";
import {
	appendChunkToAgentRun,
	appendReasoningToAgentRun,
	appendToolCallToAgentRun,
	appendToolResultToAgentRun,
	applyTokenEvent,
	applyWarningEvent,
	clearCompletedJobsFromState,
	hydrateIngestStateFromStorage,
	INGEST_STORAGE_KEY,
	serializeIngestStateForStorage,
	syncJobTokenTotals,
	upsertAgentRun,
} from "@/features/ingest/store";
import type {
	IngestAgentRun,
	IngestJob,
	IngestStoreState,
} from "@/features/ingest/store";
import type { IngestAgentEvent, IngestTokenEvent } from "@/lib/sse-stream";

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
		flowStages: [],
		buffer: [],
		enableReview: true,
		rawStreamText: "",
		...overrides,
	};
}

function agentEvent(
	overrides?: Partial<IngestAgentEvent>,
): IngestAgentEvent {
	return {
		agentRunId: "agent-1",
		stageId: "review",
		label: "Reviewer Q1",
		status: "running",
		timestamp: 1,
		...overrides,
	};
}

function tokenEvent(
	overrides?: Partial<IngestTokenEvent>,
): IngestTokenEvent {
	return {
		prompt: 10,
		completion: 20,
		total: 30,
		...overrides,
	};
}

function makeAgentRun(
	overrides?: Partial<IngestAgentRun>,
): IngestAgentRun {
	return {
		id: "agent-1",
		stageId: "review",
		label: "Reviewer Q1",
		status: "running",
		timestamp: 1,
		messages: [
			{
				id: "agent-1:system",
				role: "system",
				parts: [{ type: "text", content: "" }],
			},
			{
				id: "agent-1:user",
				role: "user",
				parts: [{ type: "text", content: "" }],
			},
			{
				id: "agent-1:assistant",
				role: "assistant",
				parts: [{ type: "text", content: "" }],
			},
		],
		systemPrompt: "",
		userPrompt: "",
		outputText: "",
		rawOutput: null,
		error: null,
		warnings: [],
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		...overrides,
	};
}

function createState(overrides?: Partial<IngestStoreState>): IngestStoreState {
	return {
		jobs: [],
		focusedJobId: null,
		...overrides,
	};
}

describe("applyWarningEvent", () => {
	it("sets agent status to warning when no existing status", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({ id: "agent-1", status: "running" }),
			],
		});

		const updated = applyWarningEvent(job, "low confidence", {
			message: "low confidence",
			agentRunId: "agent-1",
			stageId: "review",
			timestamp: 10,
		});

		const agent = updated.agentRuns[0];
		expect(agent.status).toBe("warning");
		expect(agent.warnings).toContain("low confidence");
	});

	it("preserves error status when warning arrives after error (error is terminal)", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({
					id: "agent-1",
					status: "error",
					error: "Review failed",
					warnings: [],
				}),
			],
		});

		const updated = applyWarningEvent(job, "subsequent warning", {
			message: "subsequent warning",
			agentRunId: "agent-1",
			stageId: "review",
			timestamp: 20,
		});

		const agent = updated.agentRuns[0];
		expect(agent.status).toBe("error");
		expect(agent.error).toBe("Review failed");
		expect(agent.warnings).toContain("subsequent warning");
	});
});

describe("upsertAgentRun", () => {
	it("updates agent token totals via tokens field", () => {
		const job = createJob();

		const updated = upsertAgentRun(
			job,
			agentEvent({
				agentRunId: "agent-1",
				tokens: { prompt: 100, completion: 200, total: 300 },
			}),
		);

		expect(updated.agentRuns).toHaveLength(1);
		expect(updated.agentRuns[0].tokenTotals).toEqual({
			prompt: 100,
			completion: 200,
			total: 300,
		});
	});

	it("initializes system, user, and assistant messages", () => {
		const updated = upsertAgentRun(
			createJob(),
			agentEvent({
				systemPrompt: "system prompt",
				userPrompt: "user prompt",
				rawText: "assistant text",
			}),
		);

		expect(updated.agentRuns[0].messages).toEqual([
			{
				id: "agent-1:system",
				role: "system",
				parts: [{ type: "text", content: "system prompt" }],
			},
			{
				id: "agent-1:user",
				role: "user",
				parts: [{ type: "text", content: "user prompt" }],
			},
			{
				id: "agent-1:assistant",
				role: "assistant",
				parts: [{ type: "text", content: "assistant text" }],
			},
		]);
	});

	it("appends assistant chunk text into the assistant message", () => {
		const job = upsertAgentRun(
			createJob(),
			agentEvent({
				systemPrompt: "system prompt",
				userPrompt: "user prompt",
			}),
		);

		const updated = appendChunkToAgentRun(job, "agent-1", "partial output");
		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);

		expect(updated.agentRuns[0].outputText).toBe("partial output");
		expect(assistant?.parts).toEqual([
			{ type: "text", content: "partial output" },
		]);
	});

	it("appends reasoning chunks into thinking parts on the assistant message", () => {
		const job = upsertAgentRun(
			createJob(),
			agentEvent({
				systemPrompt: "system prompt",
				userPrompt: "user prompt",
			}),
		);

		const first = appendReasoningToAgentRun(job, "agent-1", "Analisando ");
		const updated = appendReasoningToAgentRun(
			first,
			"agent-1",
			"a questao...",
		);
		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);

		expect(assistant?.parts).toEqual([
			{ type: "thinking", content: "Analisando a questao..." },
		]);
	});

	it("appends tool-call and tool-result parts to the assistant message", () => {
		const job = upsertAgentRun(createJob(), agentEvent());

		const withToolCall = appendToolCallToAgentRun(
			job,
			agentEvent({
				eventType: "tool-call",
				name: "search_docs",
				arguments: "{\"query\":\"ingest\"}",
				state: "input-complete",
				input: { query: "ingest" },
			}),
		);
		const withToolResult = appendToolResultToAgentRun(
			withToolCall,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true },
				state: "complete",
			}),
		);

		const assistant = withToolResult.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);

		expect(assistant?.parts).toEqual([
			{
				type: "tool-call",
				id: "agent-1:tool-call:0",
				name: "search_docs",
				arguments: "{\"query\":\"ingest\"}",
				input: { query: "ingest" },
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "agent-1:tool-call:0",
				content: "{\n  \"ok\": true\n}",
				state: "complete",
			},
		]);
	});

	it("preserves existing tool parts when a later lifecycle event updates prompts or status", () => {
		const job = upsertAgentRun(
			createJob(),
			agentEvent({
				systemPrompt: "initial system",
				userPrompt: "initial user",
			}),
		);

		const withToolParts = appendToolResultToAgentRun(
			appendToolCallToAgentRun(
				job,
				agentEvent({
					eventType: "tool-call",
					name: "update_extracted_question",
					arguments: '{"questionId":"q1"}',
					input: { questionId: "q1" },
					state: "input-complete",
					meta: { toolCallId: "tool-1" },
				}),
			),
			agentEvent({
				eventType: "tool-result",
				content: { ok: true, questionId: "q1" },
				state: "complete",
				meta: { toolCallId: "tool-1" },
			}),
		);

		const updated = upsertAgentRun(
			withToolParts,
			agentEvent({
				status: "done",
				systemPrompt: "updated system",
				userPrompt: "updated user",
				rawText: "final raw text",
			}),
		);

		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);

		expect(updated.agentRuns[0].status).toBe("done");
		expect(updated.agentRuns[0].systemPrompt).toBe("updated system");
		expect(updated.agentRuns[0].userPrompt).toBe("updated user");
		expect(assistant?.parts).toEqual([
			{
				type: "tool-call",
				id: "tool-1",
				name: "update_extracted_question",
				arguments: '{"questionId":"q1"}',
				input: { questionId: "q1" },
				output: undefined,
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tool-1",
				content: '{\n  "ok": true,\n  "questionId": "q1"\n}',
				state: "complete",
				error: undefined,
			},
		]);
	});

	it("preserves warning status when a later done lifecycle arrives", () => {
		const job = upsertAgentRun(
			createJob(),
			agentEvent({
				status: "warning",
				warning: "Review failed for question #1. Keeping the original extracted question.",
			}),
		);

		const updated = upsertAgentRun(
			job,
			agentEvent({
				status: "done",
				rawText: "Reviewer finished without applying changes.",
			}),
		);

		expect(updated.agentRuns[0]?.status).toBe("warning");
		expect(updated.agentRuns[0]?.warnings).toContain(
			"Review failed for question #1. Keeping the original extracted question.",
		);
	});

	it("keeps structured tools before the final assistant text and strips pseudo tool transcript", () => {
		const job = upsertAgentRun(createJob(), agentEvent());

		const withTranscript = appendChunkToAgentRun(
			job,
			"agent-1",
			[
				"Extraction complete. Successfully added 1 question.",
				"",
				"TOOL CALL: add_extracted_question",
				'{"question":"Qual e a derivada de f(x) = x^2?"}',
			].join("\n"),
		);
		const withToolCall = appendToolCallToAgentRun(
			withTranscript,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: '{"question":"Qual e a derivada de f(x) = x^2?"}',
				input: { question: "Qual e a derivada de f(x) = x^2?" },
				state: "input-complete",
				meta: { toolCallId: "tool-structured-1" },
			}),
		);
		const updated = appendToolResultToAgentRun(
			withToolCall,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true },
				state: "complete",
				meta: { toolCallId: "tool-structured-1" },
			}),
		);

		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);
		const textPart = assistant?.parts.find((part) => part.type === "text");

		expect(updated.agentRuns[0].outputText).toContain("TOOL CALL: add_extracted_question");
		expect(assistant?.parts).toContainEqual({
			type: "tool-call",
			id: "tool-structured-1",
			name: "add_extracted_question",
			arguments: '{"question":"Qual e a derivada de f(x) = x^2?"}',
			input: { question: "Qual e a derivada de f(x) = x^2?" },
			output: undefined,
			state: "input-complete",
		});
		expect(assistant?.parts).toContainEqual({
			type: "tool-result",
			toolCallId: "tool-structured-1",
			content: "{\n  \"ok\": true\n}",
			state: "complete",
			error: undefined,
		});
		expect(assistant?.parts[0]).toEqual({
			type: "text",
			content: "Extraction complete. Successfully added 1 question.",
		});
		expect(textPart).toEqual(assistant?.parts[0]);
	});

	it("stores completed tool results independently for consecutive tool calls", () => {
		const job = upsertAgentRun(createJob(), agentEvent());
		const withFirstCall = appendToolCallToAgentRun(
			job,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: '{"questionId":"q1"}',
				state: "input-complete",
				meta: { toolCallId: "tc-1" },
			}),
		);
		const withSecondCall = appendToolCallToAgentRun(
			withFirstCall,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: '{"questionId":"q2"}',
				state: "input-streaming",
				meta: { toolCallId: "tc-2" },
			}),
		);
		const withFirstResult = appendToolResultToAgentRun(
			withSecondCall,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true, questionId: "q1" },
				state: "complete",
				meta: { toolCallId: "tc-1" },
			}),
		);

		const assistant = withFirstResult.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);
		const toolResults =
			assistant?.parts.filter((part) => part.type === "tool-result") ?? [];

		expect(toolResults).toEqual([
			{
				type: "tool-result",
				toolCallId: "tc-1",
				content: '{\n  "ok": true,\n  "questionId": "q1"\n}',
				state: "complete",
				error: undefined,
			},
		]);
	});

	it("preserves streaming order when new assistant text arrives after a tool event", () => {
		const job = upsertAgentRun(createJob(), agentEvent());

		const withLeadingText = appendChunkToAgentRun(
			job,
			"agent-1",
			"Vou conferir a pergunta antes de editar.",
		);
		const withToolCall = appendToolCallToAgentRun(
			withLeadingText,
			agentEvent({
				eventType: "tool-call",
				name: "list_extracted_questions",
				arguments: "{}",
				input: {},
				state: "input-complete",
				meta: { toolCallId: "tool-order-1" },
			}),
		);
		const withToolResult = appendToolResultToAgentRun(
			withToolCall,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true },
				state: "complete",
				meta: { toolCallId: "tool-order-1" },
			}),
		);
		const updated = appendChunkToAgentRun(
			withToolResult,
			"agent-1",
			"Agora vou ajustar a alternativa correta.",
		);

		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);

		expect(assistant?.parts).toEqual([
			{ type: "text", content: "Vou conferir a pergunta antes de editar." },
			{
				type: "tool-call",
				id: "tool-order-1",
				name: "list_extracted_questions",
				arguments: "{}",
				input: {},
				output: undefined,
				state: "input-complete",
			},
			{
				type: "tool-result",
				toolCallId: "tool-order-1",
				content: "{\n  \"ok\": true\n}",
				state: "complete",
				error: undefined,
			},
			{
				type: "text",
				content: "Agora vou ajustar a alternativa correta.",
			},
		]);
	});

	it("deduplicates repeated tool-call and tool-result events for the same toolCallId", () => {
		const job = upsertAgentRun(createJob(), agentEvent());

		const withToolCall = appendToolCallToAgentRun(
			job,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: '{"question":"Q1"}',
				input: { question: "Q1" },
				state: "input-complete",
				meta: { toolCallId: "tool-dedupe-1" },
			}),
		);
		const withDuplicateToolCall = appendToolCallToAgentRun(
			withToolCall,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: '{"question":"Q1","topic":"General"}',
				input: { question: "Q1", topic: "General" },
				state: "input-complete",
				meta: { toolCallId: "tool-dedupe-1" },
			}),
		);
		const withToolResult = appendToolResultToAgentRun(
			withDuplicateToolCall,
			agentEvent({
				eventType: "tool-result",
				content: { ok: false, error: { message: "retry" } },
				state: "error",
				error: "retry",
				meta: { toolCallId: "tool-dedupe-1" },
			}),
		);
		const updated = appendToolResultToAgentRun(
			withToolResult,
			agentEvent({
				eventType: "tool-result",
				content: { ok: true, questionId: "q1" },
				state: "complete",
				meta: { toolCallId: "tool-dedupe-1" },
			}),
		);

		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);
		const toolCalls =
			assistant?.parts.filter((part) => part.type === "tool-call") ?? [];
		const toolResults =
			assistant?.parts.filter((part) => part.type === "tool-result") ?? [];

		expect(toolCalls).toEqual([
			{
				type: "tool-call",
				id: "tool-dedupe-1",
				name: "add_extracted_question",
				arguments: '{"question":"Q1","topic":"General"}',
				input: { question: "Q1", topic: "General" },
				output: undefined,
				state: "input-complete",
			},
		]);
		expect(toolResults).toEqual([
			{
				type: "tool-result",
				toolCallId: "tool-dedupe-1",
				content: '{\n  "ok": true,\n  "questionId": "q1"\n}',
				state: "complete",
				error: undefined,
			},
		]);
	});

	it("keeps the richer original tool-call input when a duplicate replay arrives empty", () => {
		const job = upsertAgentRun(createJob(), agentEvent());

		const withToolCall = appendToolCallToAgentRun(
			job,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: '{"question":"Qual e a derivada?","answer":"2x"}',
				input: { question: "Qual e a derivada?", answer: "2x" },
				state: "input-complete",
				meta: { toolCallId: "tool-rich-1" },
			}),
		);
		const updated = appendToolCallToAgentRun(
			withToolCall,
			agentEvent({
				eventType: "tool-call",
				name: "add_extracted_question",
				arguments: "{}",
				input: {},
				output: { ok: true, questionId: "q1" },
				state: "input-complete",
				meta: { toolCallId: "tool-rich-1" },
			}),
		);

		const assistant = updated.agentRuns[0].messages.find(
			(message) => message.role === "assistant",
		);
		const toolCall = assistant?.parts.find((part) => part.type === "tool-call");

		expect(toolCall).toEqual({
			type: "tool-call",
			id: "tool-rich-1",
			name: "add_extracted_question",
			arguments: '{"question":"Qual e a derivada?","answer":"2x"}',
			input: { question: "Qual e a derivada?", answer: "2x" },
			output: undefined,
			state: "input-complete",
		});
	});
});

describe("applyTokenEvent", () => {
	it("without agentRunId adds tokens to both job.tokenTotals and nonAgentTokenTotals", () => {
		const job = createJob();

		const updated = applyTokenEvent(job, tokenEvent());

		expect(updated.tokenTotals).toEqual({ prompt: 10, completion: 20, total: 30 });
		expect(updated.nonAgentTokenTotals).toEqual({ prompt: 10, completion: 20, total: 30 });
	});

	it("without agentRunId accumulates non-agent tokens across multiple events", () => {
		const job = createJob();

		const first = applyTokenEvent(job, tokenEvent({ prompt: 5, completion: 5, total: 10 }));
		const second = applyTokenEvent(first, tokenEvent({ prompt: 3, completion: 7, total: 10 }));

		expect(second.tokenTotals).toEqual({ prompt: 8, completion: 12, total: 20 });
		expect(second.nonAgentTokenTotals).toEqual({ prompt: 8, completion: 12, total: 20 });
	});

	it("with agentRunId updates agent and job totals include non-agent pool", () => {
		const job = createJob({
			nonAgentTokenTotals: { prompt: 5, completion: 5, total: 10 },
			tokenTotals: { prompt: 5, completion: 5, total: 10 },
		});

		const updated = applyTokenEvent(
			job,
			tokenEvent({
				agentRunId: "agent-1",
				prompt: 50,
				completion: 100,
				total: 150,
			}),
		);

		expect(updated.agentRuns).toHaveLength(1);
		expect(updated.agentRuns[0].tokenTotals).toEqual({
			prompt: 50,
			completion: 100,
			total: 150,
		});
		expect(updated.tokenTotals).toEqual({
			prompt: 55,
			completion: 105,
			total: 160,
		});
		expect(updated.nonAgentTokenTotals).toEqual({
			prompt: 5,
			completion: 5,
			total: 10,
		});
	});

	it("multiple agent tokens sum in job totals with non-agent tokens preserved", () => {
		const job = createJob();

		const withNonAgent = applyTokenEvent(
			job,
			tokenEvent({ prompt: 10, completion: 20, total: 30 }),
		);

		const withAgent1 = applyTokenEvent(
			withNonAgent,
			tokenEvent({
				agentRunId: "agent-1",
				prompt: 100,
				completion: 200,
				total: 300,
			}),
		);

		const withAgent2 = applyTokenEvent(
			withAgent1,
			tokenEvent({
				agentRunId: "agent-2",
				prompt: 50,
				completion: 100,
				total: 150,
			}),
		);

		expect(withAgent2.agentRuns).toHaveLength(2);
		expect(withAgent2.tokenTotals).toEqual({
			prompt: 160,
			completion: 320,
			total: 480,
		});
		expect(withAgent2.nonAgentTokenTotals).toEqual({
			prompt: 10,
			completion: 20,
			total: 30,
		});
	});
});

describe("syncJobTokenTotals", () => {
	it("combines agent totals with non-agent pool", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({
					id: "agent-1",
					tokenTotals: { prompt: 100, completion: 200, total: 300 },
				}),
				makeAgentRun({
					id: "agent-2",
					tokenTotals: { prompt: 50, completion: 75, total: 125 },
				}),
			],
			nonAgentTokenTotals: { prompt: 30, completion: 40, total: 70 },
		});

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 180,
			completion: 315,
			total: 495,
		});
	});

	it("returns zero totals when no agents and no non-agent tokens", () => {
		const job = createJob();

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 0,
			completion: 0,
			total: 0,
		});
	});

	it("preserves non-agent tokens when agent totals are zero", () => {
		const job = createJob({
			nonAgentTokenTotals: { prompt: 20, completion: 30, total: 50 },
		});

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 20,
			completion: 30,
			total: 50,
		});
	});
});

describe("ingest storage persistence", () => {
	it("serializes jobs without persisting raw file buffers", () => {
		const state = createState({
			jobs: [
				createJob({
					id: "job-persisted",
					buffer: [1, 2, 3],
					status: "success",
				}),
			],
			focusedJobId: "job-persisted",
		});

		const serialized = serializeIngestStateForStorage(state);
		const parsed = JSON.parse(serialized) as IngestStoreState;

		expect(parsed.focusedJobId).toBe("job-persisted");
		expect(parsed.jobs).toHaveLength(1);
		expect(parsed.jobs[0]).not.toHaveProperty("buffer");
	});

	it("hydrates queued and running jobs as canceled after reload", () => {
		const saved = JSON.stringify({
			jobs: [
				{
					...createJob({
						id: "job-running",
						status: "running",
						buffer: [9, 9, 9],
						finishedAt: null,
					}),
				},
				{
					...createJob({
						id: "job-done",
						status: "success",
						finishedAt: 20,
					}),
				},
			],
			focusedJobId: "job-running",
		});

		const hydrated = hydrateIngestStateFromStorage(saved);

		expect(hydrated.jobs).toHaveLength(2);
		expect(hydrated.jobs[0]).toMatchObject({
			id: "job-running",
			status: "canceled",
			buffer: [],
			error: "Ingest interrupted after page reload",
			stepText: "Interrupted after reload",
		});
		expect(hydrated.jobs[0].finishedAt).toBeTypeOf("number");
		expect(hydrated.jobs[1]).toMatchObject({
			id: "job-done",
			status: "success",
			buffer: [],
		});
		expect(hydrated.focusedJobId).toBe("job-running");
	});

	it("hydrates legacy agent runs without messages using prompt/output fallback", () => {
		const saved = JSON.stringify({
			jobs: [
				{
					...createJob({
						id: "job-legacy",
						status: "success",
						agentRuns: [
							{
								id: "agent-legacy",
								stageId: "review",
								label: "Legacy reviewer",
								status: "done",
								timestamp: 10,
								systemPrompt: "legacy system",
								userPrompt: "legacy user",
								outputText: "legacy output",
								rawOutput: null,
								error: null,
								warnings: [],
								tokenTotals: { prompt: 1, completion: 2, total: 3 },
							} as unknown as IngestAgentRun,
						],
					}),
				},
			],
			focusedJobId: "job-legacy",
		});

		const hydrated = hydrateIngestStateFromStorage(saved);
		const messages = hydrated.jobs[0]?.agentRuns[0]?.messages;

		expect(messages).toEqual([
			{
				id: "agent-legacy:system",
				role: "system",
				parts: [{ type: "text", content: "legacy system" }],
			},
			{
				id: "agent-legacy:user",
				role: "user",
				parts: [{ type: "text", content: "legacy user" }],
			},
			{
				id: "agent-legacy:assistant",
				role: "assistant",
				parts: [{ type: "text", content: "legacy output" }],
			},
		]);
	});

	it("clears only completed jobs from state", () => {
		const state = createState({
			jobs: [
				createJob({ id: "job-running", status: "running" }),
				createJob({ id: "job-success", status: "success", finishedAt: 10 }),
				createJob({ id: "job-error", status: "error", finishedAt: 11 }),
			],
			focusedJobId: "job-error",
		});

		const nextState = clearCompletedJobsFromState(state);

		expect(nextState.jobs.map((job) => job.id)).toEqual(["job-running"]);
		expect(nextState.focusedJobId).toBeNull();
	});

	it("uses the expected localStorage key", () => {
		expect(INGEST_STORAGE_KEY).toBe("ingest-jobs");
	});
});
