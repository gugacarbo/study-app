import type { TextStreamPart, ToolSet } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { getPendingQuestionImprovementDraftsByExam } from "@/db/queries/question-improvement-drafts";
import { runImproveQuestionAgent } from "@/features/ai/jobs/improve-questions/run-improve-question-agent";

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

async function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

describe("runImproveQuestionAgent", () => {
	it("reads a single question and persists a full pending draft through tools", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		const questionId = createId();
		const jobId = createId();

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Qual a capital do Brasil?",
			options: JSON.stringify([
				{ key: "A", text: "São Paulo" },
				{ key: "B", text: "Brasília" },
				{ key: "C", text: "Rio de Janeiro" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
			topic: "Geografia",
		});

		const streamTextMock = vi.fn((input: { tools?: ToolSet }) => {
			const getQuestion = getTool(input.tools, "get_question");
			const updateDraft = getTool(input.tools, "update_question_draft");

			return {
				fullStream: (async function* () {
					yield {
						type: "text-delta",
						text: "Analisando a questão...",
					} as TextStreamPart<ToolSet>;

					await getQuestion.execute({ questionId }, { toolCallId: "tool-1" });
					yield {
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "get_question",
						input: { questionId },
					} as TextStreamPart<ToolSet>;

					await updateDraft.execute({
						questionId,
						question: "Qual é a capital federal do Brasil?",
						options: [
							{ key: "A", text: "São Paulo" },
							{ key: "B", text: "Brasília" },
							{ key: "C", text: "Belo Horizonte" },
						],
						answers: ["B"],
						topic: "Geografia do Brasil",
						scoringMode: "exact",
						explanation: "Brasília é a capital federal desde 1960.",
						deepExplanation:
							"A capital foi transferida do Rio de Janeiro para Brasília em 1960.",
						summary: "Refinei enunciado, tópico e distratores.",
					}, { toolCallId: "tool-2" });
					yield {
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "update_question_draft",
						input: { questionId },
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const events: unknown[] = [];
		const result = await runImproveQuestionAgent({
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

		expect(result.summary).toBe("Refinei enunciado, tópico e distratores.");
		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.stringContaining(
					"Set topic as a summary of the question text with at most 30 characters.",
				),
				tools: expect.objectContaining({
					get_question: expect.any(Object),
					search_similar_topics: expect.any(Object),
					create_topic: expect.any(Object),
					update_question_draft: expect.any(Object),
				}),
			}),
		);

		const drafts = await getPendingQuestionImprovementDraftsByExam(
			db,
			examId,
			userId,
		);
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({
			questionId,
			summary: "Refinei enunciado, tópico e distratores.",
			improvedSnapshot: expect.objectContaining({
				question: "Qual é a capital federal do Brasil?",
				topic: "Geografia do Brasil",
			}),
		});
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-improve-question-stage",
					data: expect.objectContaining({
						questionId,
						stage: "loading_question",
					}),
				}),
				expect.objectContaining({
					type: "data-improve-question-stage",
					data: expect.objectContaining({
						questionId,
						stage: "saving_draft",
					}),
				}),
				expect.objectContaining({
					type: "text",
					questionId,
					messageId: expect.stringContaining(questionId),
					text: "Analisando a questão...",
				}),
				expect.objectContaining({
					type: "tool-call",
					questionId,
					messageId: expect.stringContaining(questionId),
					toolCallId: "tool-1",
					toolName: "get_question",
				}),
				expect.objectContaining({
					type: "tool-result",
					questionId,
					messageId: expect.stringContaining(questionId),
					toolCallId: "tool-2",
				}),
			]),
		);
		expect(events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-improve-question-status",
					data: expect.objectContaining({
						questionId,
						status: "completed",
					}),
				}),
			]),
		);
	});

	it("includes the option explanation instruction in the prompt and persists explanations when writeOptionExplanations is true", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		const questionId = createId();
		const jobId = createId();

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Qual a capital do Brasil?",
			options: JSON.stringify([
				{ key: "A", text: "São Paulo" },
				{ key: "B", text: "Brasília" },
				{ key: "C", text: "Belo Horizonte" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
			topic: "Geografia",
		});

		const streamTextMock = vi.fn((input: { tools?: ToolSet }) => {
			const getQuestion = getTool(input.tools, "get_question");
			const updateDraft = getTool(input.tools, "update_question_draft");

			return {
				fullStream: (async function* () {
					yield {
						type: "text-delta",
						text: "Analisando a questão...",
					} as TextStreamPart<ToolSet>;

					await getQuestion.execute({ questionId }, { toolCallId: "tool-1" });
					yield {
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "get_question",
						input: { questionId },
					} as TextStreamPart<ToolSet>;

					await updateDraft.execute({
						questionId,
						question: "Qual é a capital federal do Brasil?",
						options: [
							{ key: "A", text: "São Paulo", explanation: "São Paulo não é a capital federal, é a capital do estado de SP." },
							{ key: "B", text: "Brasília", explanation: "Brasília é a capital federal desde 1960." },
							{ key: "C", text: "Belo Horizonte", explanation: "Belo Horizonte é a capital de MG, não do Brasil." },
						],
						answers: ["B"],
						topic: "Geografia do Brasil",
						scoringMode: "exact",
						explanation: "Brasília é a capital federal desde 1960.",
						deepExplanation:
							"A capital foi transferida do Rio de Janeiro para Brasília em 1960.",
						summary: "Gerei explicações por alternativa.",
					}, { toolCallId: "tool-2" });
					yield {
						type: "tool-call",
						toolCallId: "tool-2",
						toolName: "update_question_draft",
						input: { questionId },
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const events: unknown[] = [];
		const result = await runImproveQuestionAgent({
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
			writeOptionExplanations: true,
		});

		expect(result.summary).toBe("Gerei explicações por alternativa.");
		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.stringContaining(
					"Also generate an explanation for each option explaining why it is correct or incorrect",
				),
				tools: expect.objectContaining({
					get_question: expect.any(Object),
					search_similar_topics: expect.any(Object),
					create_topic: expect.any(Object),
					update_question_draft: expect.any(Object),
				}),
			}),
		);

		const drafts = await getPendingQuestionImprovementDraftsByExam(
			db,
			examId,
			userId,
		);
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({
			questionId,
			summary: "Gerei explicações por alternativa.",
			improvedSnapshot: expect.objectContaining({
				question: "Qual é a capital federal do Brasil?",
				topic: "Geografia do Brasil",
			}),
		});
		const snapshot = drafts[0].improvedSnapshot as Record<string, unknown>;
		const options = snapshot.options as Array<Record<string, unknown>>;
		expect(options[0].explanation).toBe("São Paulo não é a capital federal, é a capital do estado de SP.");
		expect(options[1].explanation).toBe("Brasília é a capital federal desde 1960.");
		expect(options[2].explanation).toBe("Belo Horizonte é a capital de MG, não do Brasil.");
	});

	it("rejects improved question drafts with topics longer than 30 characters", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		const questionId = createId();
		const jobId = createId();

		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Qual a capital do Brasil?",
			options: JSON.stringify([
				{ key: "A", text: "São Paulo" },
				{ key: "B", text: "Brasília" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "exact",
			topic: "Geografia",
		});

		const streamTextMock = vi.fn((input: { tools?: ToolSet }) => {
			const updateDraft = getTool(input.tools, "update_question_draft");

			return {
				fullStream: (async function* () {
					await updateDraft.execute(
						{
							questionId,
							question: "Qual é a capital federal do Brasil?",
							options: [
								{ key: "A", text: "São Paulo" },
								{ key: "B", text: "Brasília" },
							],
							answers: ["B"],
							topic: "Capital federal brasileira atual",
							scoringMode: "exact",
						},
						{ toolCallId: "tool-1" },
					);
				})(),
			};
		});

		await expect(
			runImproveQuestionAgent({
				db,
				jobId,
				userId,
				examId,
				questionId,
				model: {} as never,
				streamText: streamTextMock as never,
				appendJobEvent: async () => {},
			}),
		).rejects.toThrow("Too big");
	});
});
