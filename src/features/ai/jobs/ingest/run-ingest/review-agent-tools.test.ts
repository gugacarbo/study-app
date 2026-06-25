import { describe, expect, it, vi } from "vitest";
import {
	createReviewAgentTools,
	type ReviewDraftQuestion,
} from "@/features/ai/jobs/ingest/run-ingest/review-agent-tools";

function makeDraft(index: number): ReviewDraftQuestion {
	return {
		draftQuestionId: `draft-${index}`,
		sourceIndex: index,
		question: `${index}. Questão ${index}?`,
		options: [
			{ key: "A", text: "A) Opção A" },
			{ key: "B", text: "B. Opção B" },
		],
		answers: ["B"],
		topic: "Geo",
		topicId: `topic-${index}`,
	};
}

describe("createReviewAgentTools", () => {
	it("exposes topic search and creation tools", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishReview = vi.fn();
		const drafts = [makeDraft(1)];
		const tools = createReviewAgentTools({
			append,
			getCurrentMessageId: () => "review-step-1",
			drafts,
			onFinishReview,
			searchSimilarTopics: vi.fn(async () => [
				{
					topicId: "topic-geo",
					name: "Geografia",
					normalizedName: "geografia",
					similarityLabel: "normalized_exact",
				},
			]),
			createTopic: vi.fn(async (name: string) => ({
				topicId: "topic-new",
				name,
				normalizedName: name.toLowerCase(),
			})),
		} as never);

		const searchResult = await tools.search_similar_topics.execute?.(
			{ query: "Geografia" },
			{
				toolCallId: "search-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(searchResult).toEqual({
			ok: true,
			topics: [
				{
					topicId: "topic-geo",
					name: "Geografia",
					normalizedName: "geografia",
					similarityLabel: "normalized_exact",
				},
			],
		});
	});

	it("lists buffered draft questions with stable ids", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishReview = vi.fn();
		const drafts = [makeDraft(1), makeDraft(2)];
		const tools = createReviewAgentTools({
			append,
			getCurrentMessageId: () => "review-step-1",
			drafts,
			onFinishReview,
		} as never);

		const result = await tools.list_questions.execute?.(
			{},
			{
				toolCallId: "list-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(result).toEqual({
			ok: true,
			total: 2,
			questions: drafts,
		});
		expect(onFinishReview).not.toHaveBeenCalled();
	});

	it("updates every editable field and canonicalizes keys/answers", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishReview = vi.fn();
		const drafts = [makeDraft(1)];
		const tools = createReviewAgentTools({
			append,
			getCurrentMessageId: () => "review-step-1",
			drafts,
			onFinishReview,
		} as never);

		const result = await tools.update_question.execute?.(
			{
				draftQuestionId: "draft-1",
				question: "Q1) Texto revisado?",
				options: [
					{ key: "B", text: "b. Segunda opção" },
					{ key: "A", text: "A) Primeira opção" },
				],
				answers: ["B"],
				topic: "Geografia",
				topicId: "topic-geo",
			},
			{
				toolCallId: "update-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(result).toEqual({
			ok: true,
			question: {
				draftQuestionId: "draft-1",
				sourceIndex: 1,
				question: "Texto revisado?",
				options: [
					{ key: "A", text: "Segunda opção" },
					{ key: "B", text: "Primeira opção" },
				],
				answers: ["A"],
				topic: "Geografia",
				topicId: "topic-geo",
			},
		});
	});

	it("rejects cardinality changes in the options list", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishReview = vi.fn();
		const drafts = [makeDraft(1)];
		const tools = createReviewAgentTools({
			append,
			getCurrentMessageId: () => "review-step-1",
			drafts,
			onFinishReview,
		} as never);

		const result = await tools.update_question.execute?.(
			{
				draftQuestionId: "draft-1",
				question: "Questão revisada?",
				options: [
					{ key: "A", text: "Opção A" },
					{ key: "B", text: "Opção B" },
					{ key: "C", text: "Opção C" },
				],
				answers: ["A"],
				topic: "Geografia",
				topicId: "topic-geo",
			},
			{
				toolCallId: "update-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(result).toEqual({
			ok: false,
			reason: "option_count_mismatch",
		});
		expect(drafts[0]?.options).toHaveLength(2);
	});

	it("requires fresh verification before finish_review", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishReview = vi.fn();
		const drafts = [makeDraft(1)];
		const tools = createReviewAgentTools({
			append,
			getCurrentMessageId: () => "review-step-1",
			drafts,
			onFinishReview,
		} as never);

		const firstFinish = await tools.finish_review.execute?.(
			{ total: 1, summary: "Revisão concluída." },
			{
				toolCallId: "finish-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(firstFinish).toEqual({
			ok: false,
			reason: "questions_not_verified",
		});

		await tools.list_questions.execute?.(
			{},
			{
				toolCallId: "list-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		const wrongTotal = await tools.finish_review.execute?.(
			{ total: 2, summary: "Revisão concluída." },
			{
				toolCallId: "finish-2",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(wrongTotal).toEqual({
			ok: false,
			reason: "submitted_total_mismatch",
		});

		const success = await tools.finish_review.execute?.(
			{
				total: 1,
				summary: "Revisão concluída.",
				alerts: ["Alternativa B foi ajustada manualmente."],
			},
			{
				toolCallId: "finish-3",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(success).toEqual({
			ok: true,
			total: 1,
			summary: "Revisão concluída.",
			alerts: ["Alternativa B foi ajustada manualmente."],
			verified: true,
		});
		expect(append).toHaveBeenLastCalledWith(
			expect.stringContaining("- Alternativa B foi ajustada manualmente."),
		);
		expect(onFinishReview).toHaveBeenCalledTimes(1);
	});
});
