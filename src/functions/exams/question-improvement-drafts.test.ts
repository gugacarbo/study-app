import { beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	getPendingQuestionImprovementDraftsByExam,
	upsertPendingQuestionImprovementDraft,
} from "@/db/queries/question-improvement-drafts";
import * as schema from "@/db/schema";
import {
	resetJobTestDb,
	seedExam,
	seedUser,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import {
	getQuestionImprovementDraftsHandler,
	resolveQuestionImprovementDraftHandler,
} from "@/functions/exams/question-improvement-drafts";

describe("question improvement drafts server functions", () => {
	beforeEach(async () => {
		resetJobTestDb();
		await seedUser(testDb, testUserId);
	});

	it("lists pending drafts for the current user's exam", async () => {
		const examId = await seedExam(testDb, testUserId);
		const questionId = createId();
		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Pergunta",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		await upsertPendingQuestionImprovementDraft(testDb, {
			id: createId(),
			userId: testUserId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: {
				question: "Pergunta",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "2" },
				],
				answers: ["A"],
				topic: null,
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Pergunta melhorada",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "2" },
				],
				answers: ["A"],
				topic: null,
				scoringMode: "exact",
				explanation: "Curta",
				deepExplanation: null,
			},
			summary: "Resumo",
			metadata: null,
		});

		const drafts = await getQuestionImprovementDraftsHandler(
			{ examId },
			new Headers(),
		);
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({
			questionId,
			improvedSnapshot: expect.objectContaining({
				question: "Pergunta melhorada",
			}),
		});
	});

	it("approves a draft with a reviewed final snapshot and removes it from the pending list", async () => {
		const examId = await seedExam(testDb, testUserId);
		const questionId = createId();
		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Original",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		const draft = await upsertPendingQuestionImprovementDraft(testDb, {
			id: createId(),
			userId: testUserId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: {
				question: "Original",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "2" },
				],
				answers: ["A"],
				topic: null,
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Aprovada",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "2" },
				],
				answers: ["A"],
				topic: null,
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			summary: null,
			metadata: null,
		});

		const approved = await resolveQuestionImprovementDraftHandler(
			{
				draftId: draft.id,
				action: "approve",
				finalSnapshot: {
					question: "Versão final revisada",
					options: [
						{ key: "A", text: "1" },
						{ key: "B", text: "2" },
					],
					answers: ["A"],
					topic: "Tema revisado",
					scoringMode: "exact",
					explanation: "Explicação final",
					deepExplanation: null,
				},
			},
			new Headers(),
		);
		expect(approved).toEqual({ ok: true });

		const drafts = await getPendingQuestionImprovementDraftsByExam(
			testDb,
			examId,
			testUserId,
		);
		expect(drafts).toHaveLength(0);
	});

	it("discards a draft without changing the question", async () => {
		const examId = await seedExam(testDb, testUserId);
		const questionId = createId();
		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Original",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		const draft = await upsertPendingQuestionImprovementDraft(testDb, {
			id: createId(),
			userId: testUserId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: {
				question: "Original",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "2" },
				],
				answers: ["A"],
				topic: null,
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Descartada",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "2" },
				],
				answers: ["A"],
				topic: null,
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			summary: null,
			metadata: null,
		});

		const discarded = await resolveQuestionImprovementDraftHandler(
			{ draftId: draft.id, action: "discard" },
			new Headers(),
		);
		expect(discarded).toEqual({ ok: true });
	});
});
