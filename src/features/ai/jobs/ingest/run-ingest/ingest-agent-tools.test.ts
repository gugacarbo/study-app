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
			verified: true,
		});
		expect(onFinishExtraction).toHaveBeenCalledTimes(1);
	});
});
