import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import { upsertPendingQuestionImprovementDraft } from "@/db/queries/question-improvement-drafts";
import * as schema from "@/db/schema";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import {
	IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
	JOB_KIND,
	JOB_STATUS,
	parseImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

vi.mock("@/functions/queue", () => ({
	enqueueJob: vi.fn(async () => undefined),
}));

async function createImproveQuestionsJobHandler(
	body: unknown,
	headers: Headers,
) {
	const module = await import("@/functions/jobs/create-improve-questions-job");
	return module.createImproveQuestionsJobHandler(body, headers);
}

describe("createImproveQuestionsJobHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("creates a queued improve-questions job for selected exam questions", async () => {
		const { enqueueJob } = await import("@/functions/queue");
		await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const questionId = createId();

		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Capital do Brasil?",
			options: JSON.stringify([
				{ key: "A", text: "Brasília" },
				{ key: "B", text: "São Paulo" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		const response = await createImproveQuestionsJobHandler(
			{ kind: "improve-questions", examId, questionIds: [questionId] },
			new Headers(),
		);
		expect(response.status).toBe(200);

		const body = (await response.json()) as { jobId: string };
		const [job] = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, body.jobId));

		expect(job).toMatchObject({
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.QUEUED,
		});
		expect(enqueueJob).toHaveBeenCalledWith(body.jobId);
		expect(
			parseImproveQuestionsJobMetadata(job?.metadata ?? null),
		).toMatchObject({
			examId,
			writeExplanations: false,
			questionIds: [questionId],
			concurrencyLimit: IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
			queuedCount: 1,
			runningCount: 0,
			completedCount: 0,
			failedCount: 0,
			cancelledCount: 0,
			pendingReviewCount: 0,
		});
	});

	it("persists writeExplanations when requested", async () => {
		await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const questionId = createId();

		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Capital do Brasil?",
			options: JSON.stringify([
				{ key: "A", text: "Brasília" },
				{ key: "B", text: "São Paulo" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		const response = await createImproveQuestionsJobHandler(
			{
				kind: "improve-questions",
				examId,
				questionIds: [questionId],
				writeExplanations: true,
			},
			new Headers(),
		);
		expect(response.status).toBe(200);

		const body = (await response.json()) as { jobId: string };
		const [job] = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, body.jobId));

		expect(
			parseImproveQuestionsJobMetadata(job?.metadata ?? null),
		).toMatchObject({
			examId,
			questionIds: [questionId],
			writeExplanations: true,
		});
	});

	it("returns 404 when trying to improve a question from another user's exam", async () => {
		await seedDefaultModel(testDb, testUserId);
		const otherUserId = createId();
		await seedDefaultModel(testDb, otherUserId);
		const otherExamId = await seedExam(testDb, otherUserId);
		const questionId = createId();

		await testDb.insert(schema.questions).values({
			id: questionId,
			examId: otherExamId,
			question: "Outra pergunta",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		const response = await createImproveQuestionsJobHandler(
			{
				kind: "improve-questions",
				examId: otherExamId,
				questionIds: [questionId],
			},
			new Headers(),
		);
		expect(response.status).toBe(404);
	});

	it("returns 409 when there is already an active improve-questions job for the same exam", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const questionId = createId();

		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Questão ativa",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		await createJob(testDb, {
			id: createId(),
			userId: testUserId,
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.RUNNING,
			metadata: {
				examId,
				questionIds: [questionId],
				concurrencyLimit: 2,
				modelId,
				writeExplanations: false,
				writeOptionExplanations: false,
				queuedCount: 0,
				runningCount: 1,
				completedCount: 0,
				failedCount: 0,
				cancelledCount: 0,
				pendingReviewCount: 0,
				totalCount: 1,
				items: [
					{
						questionId,
						questionNumber: 1,
						status: "running",
						stage: "loading_question",
					},
				],
			},
		});

		const response = await createImproveQuestionsJobHandler(
			{ kind: "improve-questions", examId, questionIds: [questionId] },
			new Headers(),
		);
		expect(response.status).toBe(409);
		const body = (await response.json()) as {
			error: string;
			jobId?: string;
			examId?: string;
		};
		expect(body).toMatchObject({
			error: "active_job_conflict",
			jobId: expect.any(String),
			examId,
		});
	});

	it("returns 409 with the existing job when the exam still has pending improvement approvals", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = createId();
		const questionId = createId();

		await testDb.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Questão aguardando aprovação",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.COMPLETED,
			metadata: {
				examId,
				questionIds: [questionId],
				concurrencyLimit: 2,
				modelId,
				writeExplanations: false,
				writeOptionExplanations: false,
				queuedCount: 0,
				runningCount: 0,
				completedCount: 1,
				failedCount: 0,
				cancelledCount: 0,
				pendingReviewCount: 1,
				totalCount: 1,
				items: [
					{
						questionId,
						questionNumber: 1,
						status: "completed",
						stage: "saving_draft",
					},
				],
			},
		});

		await upsertPendingQuestionImprovementDraft(testDb, {
			id: createId(),
			userId: testUserId,
			examId,
			questionId,
			jobId,
			originalSnapshot: {
				question: "Questão aguardando aprovação",
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
				question: "Questão melhorada aguardando aprovação",
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
			summary: "Resumo",
			metadata: null,
		});

		const response = await createImproveQuestionsJobHandler(
			{ kind: "improve-questions", examId, questionIds: [questionId] },
			new Headers(),
		);

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			error: "active_job_conflict",
			jobId,
			examId,
		});
	});
});
