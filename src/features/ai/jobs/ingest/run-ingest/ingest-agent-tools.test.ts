import { describe, expect, it, vi } from "vitest";
import { createIngestAgentTools } from "@/features/ai/jobs/ingest/run-ingest/ingest-agent-tools";

function makeQuestion(index: number) {
	return {
		question: `Questão ${index}?`,
		options: [
			{ key: "A", text: "Opção A" },
			{ key: "B", text: "Opção B" },
		],
		answers: ["A"],
		topic: "Tópico",
	};
}

describe("createIngestAgentTools", () => {
	it("updates a submitted question by draft id before final verification", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishExtraction = vi.fn();
		const questions: ReturnType<typeof makeQuestion>[] = [];
		const tools = createIngestAgentTools({
			append,
			getCurrentMessageId: () => "ingest-step-1",
			questions,
			onFinishExtraction,
		});

		const submitted = await tools.submit_question.execute?.(makeQuestion(1), {
			toolCallId: "submit-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});

		const updateResult = await tools.update_question.execute?.(
			{
				draftQuestionId:
					submitted && "draftQuestionId" in submitted
						? submitted.draftQuestionId
						: "",
				question: "Q1) Texto corrigido?",
				options: [
					{ key: "B", text: "b. Alternativa revisada" },
					{ key: "A", text: "A) Alternativa original" },
				],
				answers: ["B"],
				topic: "Tópico revisado",
			},
			{
				toolCallId: "update-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(updateResult).toEqual({
			ok: true,
			question: {
				draftQuestionId: "draft-1",
				sourceIndex: 1,
				question: "Texto corrigido?",
				options: [
					{ key: "A", text: "Alternativa revisada" },
					{ key: "B", text: "Alternativa original" },
				],
				answers: ["A"],
				topic: "Tópico revisado",
			},
		});

		const listed = await tools.list_questions.execute?.(
			{},
			{
				toolCallId: "list-1",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(listed).toEqual({
			ok: true,
			total: 1,
			questions: [
				{
					question: "Texto corrigido?",
					options: [
						{ key: "A", text: "Alternativa revisada" },
						{ key: "B", text: "Alternativa original" },
					],
					answers: ["A"],
					topic: "Tópico revisado",
				},
			],
		});
	});

	it("returns current extracted questions for final verification", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishExtraction = vi.fn();
		const questions: ReturnType<typeof makeQuestion>[] = [];
		const tools = createIngestAgentTools({
			append,
			getCurrentMessageId: () => "ingest-step-1",
			questions,
			onFinishExtraction,
		});

		await tools.submit_question.execute?.(makeQuestion(1), {
			toolCallId: "submit-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});
		await tools.submit_question.execute?.(makeQuestion(2), {
			toolCallId: "submit-2",
			messages: [],
			abortSignal: new AbortController().signal,
		});

		const result = await tools.list_questions.execute?.({}, {
			toolCallId: "list-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});

		expect(result).toEqual({
			ok: true,
			total: 2,
			questions: [makeQuestion(1), makeQuestion(2)],
		});
		expect(onFinishExtraction).not.toHaveBeenCalled();
	});

	it("formats list_questions output so the model can review buffered questions", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishExtraction = vi.fn();
		const questions: ReturnType<typeof makeQuestion>[] = [];
		const tools = createIngestAgentTools({
			append,
			getCurrentMessageId: () => "ingest-step-1",
			questions,
			onFinishExtraction,
		});

		await tools.submit_question.execute?.(makeQuestion(1), {
			toolCallId: "submit-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});
		await tools.submit_question.execute?.(makeQuestion(2), {
			toolCallId: "submit-2",
			messages: [],
			abortSignal: new AbortController().signal,
		});

		const result = await tools.list_questions.execute?.({}, {
			toolCallId: "list-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});
		const listResult = result as {
			ok: true;
			total: number;
			questions: ReturnType<typeof makeQuestion>[];
		};
		const modelOutput = await tools.list_questions.toModelOutput?.({
			toolCallId: "list-1",
			input: {},
			output: listResult,
		});

		expect(modelOutput).toEqual({
			type: "text",
			value: expect.stringContaining('"total":2'),
		});
		expect(modelOutput).toEqual({
			type: "text",
			value: expect.stringContaining("Questão 1?"),
		});
		expect(modelOutput).toEqual({
			type: "text",
			value: expect.stringContaining("Questão 2?"),
		});
	});

	it("blocks finish_extraction until the agent verifies the extracted list", async () => {
		const append = vi.fn(async () => undefined);
		const onFinishExtraction = vi.fn();
		const questions: ReturnType<typeof makeQuestion>[] = [];
		const tools = createIngestAgentTools({
			append,
			getCurrentMessageId: () => "ingest-step-1",
			questions,
			onFinishExtraction,
		});

		await tools.submit_question.execute?.(makeQuestion(1), {
			toolCallId: "submit-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});

		const finishWithoutVerification =
			await tools.finish_extraction.execute?.(
				{
					total: 1,
					summary: "1 questão extraída.",
				},
				{
					toolCallId: "finish-1",
					messages: [],
					abortSignal: new AbortController().signal,
				},
			);

		expect(finishWithoutVerification).toEqual({
			ok: false,
			reason: "questions_not_verified",
		});
		expect(onFinishExtraction).not.toHaveBeenCalled();

		await tools.list_questions.execute?.({}, {
			toolCallId: "list-1",
			messages: [],
			abortSignal: new AbortController().signal,
		});

		const finishWithWrongTotal = await tools.finish_extraction.execute?.(
			{
				total: 2,
				summary: "2 questões extraídas.",
			},
			{
				toolCallId: "finish-2",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(finishWithWrongTotal).toEqual({
			ok: false,
			reason: "submitted_total_mismatch",
		});
		expect(onFinishExtraction).not.toHaveBeenCalled();

		const finishWithVerification = await tools.finish_extraction.execute?.(
			{
				total: 1,
				summary: "1 questão extraída.",
				alerts: [
					"Questão 1 ficou com enunciado parcialmente ilegível.",
					"Tabela original não foi preservada.",
				],
			},
			{
				toolCallId: "finish-3",
				messages: [],
				abortSignal: new AbortController().signal,
			},
		);

		expect(finishWithVerification).toEqual({
			ok: true,
			total: 1,
			summary: "1 questão extraída.",
			alerts: [
				"Questão 1 ficou com enunciado parcialmente ilegível.",
				"Tabela original não foi preservada.",
			],
			verified: true,
		});
		expect(append).toHaveBeenLastCalledWith(
			expect.stringContaining("- Questão 1 ficou com enunciado parcialmente ilegível."),
		);
		expect(append).toHaveBeenLastCalledWith(
			expect.stringContaining("- Tabela original não foi preservada."),
		);
		expect(onFinishExtraction).toHaveBeenCalledTimes(1);
	});
});
