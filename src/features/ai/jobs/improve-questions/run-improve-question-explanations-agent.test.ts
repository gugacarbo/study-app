import type { TextStreamPart, ToolSet } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import {
	getPendingQuestionImprovementDraftsByExam,
	upsertPendingQuestionImprovementDraft,
} from "@/db/queries/question-improvement-drafts";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { runImproveQuestionExplanationsAgent } from "@/features/ai/jobs/improve-questions/run-improve-question-explanations-agent";

function getTool(tools: ToolSet | undefined, name: string) {
	const tool = tools?.[name] as
		| {
				execute: (
					input: Record<string, unknown>,
					context?: { toolCallId?: string },
				) => Promise<unknown>;
		  }
		| undefined;
	if (!tool?.execute) {
		throw new Error(`Missing tool: ${name}`);
	}
	return tool;
}

function getPromptCall(
	streamTextMock: ReturnType<typeof vi.fn>,
	callIndex: number,
): string {
	const prompt = streamTextMock.mock.calls[callIndex]?.[0]?.prompt;
	if (typeof prompt !== "string") {
		throw new Error(`Missing prompt for streamText call ${callIndex}`);
	}
	return prompt;
}

async function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

describe("runImproveQuestionExplanationsAgent", () => {
	it("loads the pending draft, overwrites only explanations, and records alerts on finish", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();
		const questionId = createId();
		const jobId = createId();
		await seedUser(db, userId);
		await createExam(db, { id: examId, userId, name: "Prova" });

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Quanto é 2 + 2?",
			options: JSON.stringify([
				{ key: "A", text: "3" },
				{ key: "B", text: "4" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
		});

		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId,
			originalSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			summary: "Draft inicial.",
			metadata: null,
		});

		const streamTextMock = vi.fn((input: { tools?: ToolSet }) => {
			const listQuestion = getTool(input.tools, "list_question");
			const updateExplanations = getTool(input.tools, "update_explanations");
			const finishExplanations = getTool(input.tools, "finish_explanations");

			return {
				fullStream: (async function* () {
					await listQuestion.execute({ questionId }, { toolCallId: "tool-1" });
					yield {
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "list_question",
						input: { questionId },
					} as TextStreamPart<ToolSet>;

					await updateExplanations.execute(
						{
							questionId,
							explanation: "A soma correta é 4.",
							deepExplanation: "Somando 2 com 2, obtemos 4.",
						},
						{ toolCallId: "tool-2" },
					);
					yield {
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "update_explanations",
						input: { questionId },
					} as TextStreamPart<ToolSet>;

					await finishExplanations.execute(
						{
							summary: "Expliquei a resposta e sinalizei inconsistência.",
							alerts: ["A resposta marcada parece inconsistente com o enunciado."],
						},
						{ toolCallId: "tool-3" },
					);
					yield {
						type: "tool-call",
						toolCallId: "tool-3",
						toolName: "finish_explanations",
						input: { questionId },
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const events: unknown[] = [];
		const result = await runImproveQuestionExplanationsAgent({
			db,
			jobId,
			userId,
			examId,
			questionId,
			model: {} as never,
			streamText: streamTextMock as never,
			appendJobEvent: async (_jobId, payload) => {
				events.push(payload);
			},
		});

		expect(result).toMatchObject({
			summary: "Expliquei a resposta e sinalizei inconsistência.",
			alerts: ["A resposta marcada parece inconsistente com o enunciado."],
		});

		const drafts = await getPendingQuestionImprovementDraftsByExam(db, examId, userId);
		expect(drafts[0]).toMatchObject({
			questionId,
			summary: "Expliquei a resposta e sinalizei inconsistência.",
			improvedSnapshot: expect.objectContaining({
				explanation: "A soma correta é 4.",
				deepExplanation: "Somando 2 com 2, obtemos 4.",
			}),
			metadata: expect.stringContaining("A resposta marcada parece inconsistente"),
		});
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-improve-question-stage",
					data: expect.objectContaining({
						questionId,
						stage: "writing_explanations",
					}),
				}),
				expect.objectContaining({
					type: "data-improve-question-warning",
					data: expect.objectContaining({
						questionId,
						message: "A resposta marcada parece inconsistente com o enunciado.",
					}),
				}),
			]),
		);
	});

	it("retries up to three times with a warning when the model does not call finish_explanations", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();
		const questionId = createId();
		const jobId = createId();
		await seedUser(db, userId);
		await createExam(db, { id: examId, userId, name: "Prova" });

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Quanto é 2 + 2?",
			options: JSON.stringify([
				{ key: "A", text: "3" },
				{ key: "B", text: "4" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
		});

		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId,
			originalSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			summary: "Draft inicial.",
			metadata: null,
		});

		const streamTextMock = vi.fn(() => ({
			fullStream: (async function* () {
				yield {
					type: "text-delta",
					text: "Vou encerrar agora.",
				} as TextStreamPart<ToolSet>;
			})(),
		}));

		await expect(
			runImproveQuestionExplanationsAgent({
				db,
				jobId,
				userId,
				examId,
				questionId,
				model: {} as never,
				streamText: streamTextMock as never,
				appendJobEvent: async () => {},
			}),
		).rejects.toThrow(
			"Improve question explanations agent finished without calling finish_explanations",
		);

		expect(streamTextMock).toHaveBeenCalledTimes(4);
		expect(getPromptCall(streamTextMock, 0)).not.toContain(
			"WARNING: You must call finish_explanations",
		);
		expect(getPromptCall(streamTextMock, 1)).toContain(
			"WARNING: You must call finish_explanations before ending this run.",
		);
		expect(getPromptCall(streamTextMock, 2)).toContain(
			"Attempt 2 of 3 after missing finish_explanations.",
		);
		expect(getPromptCall(streamTextMock, 3)).toContain(
			"Attempt 3 of 3 after missing finish_explanations.",
		);
	});

	it("succeeds when a retry calls finish_explanations after a missing finish", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();
		const questionId = createId();
		const jobId = createId();
		await seedUser(db, userId);
		await createExam(db, { id: examId, userId, name: "Prova" });

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Quanto é 2 + 2?",
			options: JSON.stringify([
				{ key: "A", text: "3" },
				{ key: "B", text: "4" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
		});

		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId,
			originalSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			summary: "Draft inicial.",
			metadata: null,
		});

		const streamTextMock = vi
			.fn()
			.mockImplementationOnce(() => ({
				fullStream: (async function* () {
					yield {
						type: "text-delta",
						text: "Ainda não terminei com a tool.",
					} as TextStreamPart<ToolSet>;
				})(),
			}))
			.mockImplementationOnce((input: { tools?: ToolSet }) => {
				const listQuestion = getTool(input.tools, "list_question");
				const updateExplanations = getTool(input.tools, "update_explanations");
				const finishExplanations = getTool(input.tools, "finish_explanations");

				return {
					fullStream: (async function* () {
						await listQuestion.execute({ questionId }, { toolCallId: "tool-1" });
						yield {
							type: "tool-call",
							toolCallId: "tool-1",
							toolName: "list_question",
							input: { questionId },
						} as TextStreamPart<ToolSet>;

						await updateExplanations.execute(
							{
								questionId,
								explanation: "A soma correta é 4.",
								deepExplanation: "Somando 2 com 2, obtemos 4.",
							},
							{ toolCallId: "tool-2" },
						);
						yield {
							type: "tool-call",
							toolCallId: "tool-2",
							toolName: "update_explanations",
							input: { questionId },
						} as TextStreamPart<ToolSet>;

						await finishExplanations.execute(
							{
								summary: "Corrigi as explicações no retry.",
							},
							{ toolCallId: "tool-3" },
						);
						yield {
							type: "tool-call",
							toolCallId: "tool-3",
							toolName: "finish_explanations",
							input: {},
						} as TextStreamPart<ToolSet>;
					})(),
				};
			});

		const result = await runImproveQuestionExplanationsAgent({
			db,
			jobId,
			userId,
			examId,
			questionId,
			model: {} as never,
			streamText: streamTextMock as never,
			appendJobEvent: async () => {},
		});

		expect(result).toEqual({
			summary: "Corrigi as explicações no retry.",
			alerts: [],
		});
		expect(streamTextMock).toHaveBeenCalledTimes(2);
		expect(getPromptCall(streamTextMock, 1)).toContain(
			"WARNING: You must call finish_explanations before ending this run.",
		);
	});

	it("rejects null explanations and keeps the pending draft unchanged", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();
		const questionId = createId();
		const jobId = createId();
		await seedUser(db, userId);
		await createExam(db, { id: examId, userId, name: "Prova" });

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Quanto é 2 + 2?",
			options: JSON.stringify([
				{ key: "A", text: "3" },
				{ key: "B", text: "4" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
		});

		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId,
			originalSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: "Explicação original",
				deepExplanation: "Explicação longa original",
			},
			improvedSnapshot: {
				question: "Quanto é 2 + 2?",
				options: [
					{ key: "A", text: "3" },
					{ key: "B", text: "4" },
				],
				answers: ["B"],
				topic: "Aritmética",
				scoringMode: "exact",
				explanation: "Explicação original",
				deepExplanation: "Explicação longa original",
			},
			summary: "Draft inicial.",
			metadata: null,
		});

		const streamTextMock = vi.fn((input: { tools?: ToolSet }) => {
			const listQuestion = getTool(input.tools, "list_question");
			const updateExplanations = getTool(input.tools, "update_explanations");

			return {
				fullStream: (async function* () {
					await listQuestion.execute({ questionId }, { toolCallId: "tool-1" });
					yield {
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "list_question",
						input: { questionId },
					} as TextStreamPart<ToolSet>;

					await updateExplanations.execute(
						{
							questionId,
							explanation: null,
							deepExplanation: null,
						},
						{ toolCallId: "tool-2" },
					);
				})(),
			};
		});

		await expect(
			runImproveQuestionExplanationsAgent({
				db,
				jobId,
				userId,
				examId,
				questionId,
				model: {} as never,
				streamText: streamTextMock as never,
				appendJobEvent: async () => {},
			}),
		).rejects.toThrow();

		const drafts = await getPendingQuestionImprovementDraftsByExam(db, examId, userId);
		expect(drafts[0]?.improvedSnapshot).toMatchObject({
			explanation: "Explicação original",
			deepExplanation: "Explicação longa original",
		});
	});
});
