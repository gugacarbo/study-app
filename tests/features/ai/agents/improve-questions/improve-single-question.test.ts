import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/ai", () => ({
	toolDefinition: (definition: Record<string, unknown>) => ({
		...definition,
		server: (handler: (input: unknown) => Promise<unknown>) => ({
			...definition,
			execute: handler,
		}),
	}),
}));

const { streamChatMessagesMock } = vi.hoisted(() => ({
	streamChatMessagesMock: vi.fn(),
}));

vi.mock("@/features/ai/core/chat-stream", () => ({
	streamChatMessages: streamChatMessagesMock,
}));

import type { DraftQuestion } from "@/features/ai/agents/improve-questions/contracts";
import { improveSingleQuestion } from "@/features/ai/agents/improve-questions/improve-single-question";

type Tool = {
	name: string;
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: readonly unknown[] | undefined, name: string): Tool {
	const tool = tools?.find((candidate) => (candidate as Tool).name === name);
	if (!tool) throw new Error(`Tool ${name} not found`);
	return tool as Tool;
}

const baseQuestion: DraftQuestion = {
	id: 7,
	question: "Qual e a capital do Brasil?",
	options: ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Recife"],
	answers: ["Brasilia"],
	scoringMode: "exact",
	explanation: "Brasilia e a capital federal.",
	topic: "Geografia",
};

describe("improveSingleQuestion", () => {
	beforeEach(() => {
		streamChatMessagesMock.mockReset();
	});

	it("improves a question through workspace tools and emits workspace updates", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					yield {
						type: "TEXT_MESSAGE_CONTENT",
						delta: "Melhorando os distratores...",
					};

					const getQuestion = getTool(options?.tools, "get_question");
					const updateQuestionOptions = getTool(
						options?.tools,
						"update_question_options",
					);

					await getQuestion.execute({ id: 7 });
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-1",
						toolCallName: "get_question",
						input: { id: 7 },
						result: {
							ok: true,
							data: {
								id: 7,
								question: baseQuestion.question,
								options: baseQuestion.options,
								answers: baseQuestion.answers,
								scoringMode: baseQuestion.scoringMode,
								explanation: baseQuestion.explanation,
							},
						},
					};

					await updateQuestionOptions.execute({
						id: 7,
						options: [
							"Sao Paulo",
							"Rio de Janeiro",
							"Brasilia",
							"Salvador",
							"Belo Horizonte",
						],
						explanation: "Brasilia foi inaugurada em 1960 como capital federal.",
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-2",
						toolCallName: "update_question_options",
						input: {
							id: 7,
							options: [
								"Sao Paulo",
								"Rio de Janeiro",
								"Brasilia",
								"Salvador",
								"Belo Horizonte",
							],
							explanation:
								"Brasilia foi inaugurada em 1960 como capital federal.",
						},
						result: {
							ok: true,
							id: 7,
							updatedFields: ["options", "explanation"],
						},
					};

					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
						usage: {
							promptTokens: 14,
							completionTokens: 9,
							totalTokens: 23,
						},
					};
				})(),
		);

		const onAgentEvent = vi.fn();
		const onWorkspaceUpdate = vi.fn();
		const webTools = [{ name: "web_search", execute: vi.fn() }] as unknown[];

		const result = await improveSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			baseQuestion,
			{
				tools: webTools as never,
				onAgentEvent,
				onWorkspaceUpdate,
				createAgentRunId: () => "improve-q7",
			},
		);

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.question).toEqual({
			...baseQuestion,
			options: [
				"Sao Paulo",
				"Rio de Janeiro",
				"Brasilia",
				"Salvador",
				"Belo Horizonte",
			],
			explanation: "Brasilia foi inaugurada em 1960 como capital federal.",
		});
		expect(result.agentRun).toEqual(
			expect.objectContaining({
				agentRunId: "improve-q7",
				status: "done",
				systemPrompt: expect.stringContaining(
					"You are an exam-question specialist.",
				),
				userPrompt: expect.stringContaining("Improve question #7."),
			}),
		);
		expect(streamChatMessagesMock).toHaveBeenCalledWith(
			expect.anything(),
			[
				{
					role: "user",
					content: expect.stringContaining("Improve question #7."),
				},
			],
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({ name: "get_question" }),
					expect.objectContaining({ name: "update_question_options" }),
					expect.objectContaining({ name: "web_search" }),
				]),
				system: expect.stringContaining(
					"You are an exam-question specialist.",
				),
			}),
		);
		expect(onWorkspaceUpdate).toHaveBeenCalledWith({
			question: {
				...baseQuestion,
				options: [
					"Sao Paulo",
					"Rio de Janeiro",
					"Brasilia",
					"Salvador",
					"Belo Horizonte",
				],
				explanation: "Brasilia foi inaugurada em 1960 como capital federal.",
			},
			updatedFields: ["options", "explanation"],
		});
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "pending",
				agentRunId: "improve-q7",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "running",
				agentRunId: "improve-q7",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				eventType: "tool-call",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				name: "get_question",
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({
				eventType: "tool-result",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				content: {
					ok: true,
					data: {
						id: 7,
						question: baseQuestion.question,
						options: baseQuestion.options,
						answers: baseQuestion.answers,
						scoringMode: baseQuestion.scoringMode,
						explanation: baseQuestion.explanation,
					},
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			5,
			expect.objectContaining({
				eventType: "tool-call",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				name: "update_question_options",
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			6,
			expect.objectContaining({
				eventType: "tool-result",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				content: {
					ok: true,
					id: 7,
					updatedFields: ["options", "explanation"],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			7,
			expect.objectContaining({
				eventType: "token",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				tokens: {
					promptTokens: 14,
					completionTokens: 9,
					totalTokens: 23,
				},
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			8,
			expect.objectContaining({
				eventType: "result",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				rawText: expect.stringContaining("[tool:update_question_options]"),
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			9,
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "done",
				agentRunId: "improve-q7",
			}),
		);
	});

	it("reports failure when tool calls error out and no update is applied", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const updateQuestionOptions = getTool(
						options?.tools,
						"update_question_options",
					);

					await updateQuestionOptions.execute({
						id: 7,
						options: ["A", "B"],
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-fail-1",
						toolCallName: "update_question_options",
						input: { id: 7, options: ["A", "B"] },
						result: {
							ok: false,
							error: {
								code: "IMPROVE_QUESTIONS_TOOL_ERROR",
								message: "At least 5 options required",
							},
						},
					};

					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const onAgentEvent = vi.fn();
		const onWorkspaceUpdate = vi.fn();

		const result = await improveSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			baseQuestion,
			{
				onAgentEvent,
				onWorkspaceUpdate,
				createAgentRunId: () => "improve-q7",
			},
		);

		expect(result).toEqual({
			question: baseQuestion,
			success: false,
			reason: "At least 5 options required",
			agentRun: expect.objectContaining({
				agentRunId: "improve-q7",
				status: "error",
				error: "At least 5 options required",
			}),
		});
		expect(onWorkspaceUpdate).not.toHaveBeenCalled();
		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "error",
				agentRunId: "improve-q7",
			}),
		);
	});
});
