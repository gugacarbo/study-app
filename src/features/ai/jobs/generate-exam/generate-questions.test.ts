import { beforeEach, describe, expect, it, vi } from "vitest";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	type GenerateQuestionsDeps,
	generateQuestions,
} from "./generate-questions";
import type { GenerateExamGenerationContext } from "./types";

vi.mock("@/lib/llm-logging", () => ({
	createLlmLogCallId: vi.fn(() => "call-1"),
	logLlmCallStart: vi.fn(async () => undefined),
	logLlmCallComplete: vi.fn(async () => undefined),
}));

const userId = "00000000-0000-4000-8000-000000000401";

const metadata = {
	examId: "00000000-0000-4000-8000-000000000201",
	modelId: "model-1",
	questionCount: 3,
	difficulty: "medium" as const,
};

const generationContext: GenerateExamGenerationContext = {
	mainContent: "Conteudo base para geracao de questoes.",
	parsedContextDocuments: [],
	questionCount: 3,
	difficulty: "medium",
};

function makeValidQuestions() {
	return {
		questions: [
			{
				question: "Qual e a capital do Brasil?",
				options: [
					{ key: "A", text: "Brasilia" },
					{ key: "B", text: "Rio de Janeiro" },
					{ key: "C", text: "Sao Paulo" },
					{ key: "D", text: "Salvador" },
				],
				answers: ["A"],
				topic: "Geografia",
			},
			{
				question: "Quem descobriu o Brasil?",
				options: [
					{ key: "A", text: "Pedro Alvares Cabral" },
					{ key: "B", text: "Cristovao Colombo" },
					{ key: "C", text: "Vasco da Gama" },
					{ key: "D", text: "Fernao de Magalhaes" },
				],
				answers: ["A"],
				topic: "Historia",
			},
			{
				question: "Qual e o maior bioma brasileiro?",
				options: [
					{ key: "A", text: "Amazonia" },
					{ key: "B", text: "Cerrado" },
					{ key: "C", text: "Mata Atlantica" },
					{ key: "D", text: "Caatinga" },
				],
				answers: ["A"],
				topic: "Geografia",
			},
		],
	};
}

function makeDeps(overrides?: {
	generateObject?: (
		options: object,
	) => Promise<{ object: unknown; usage?: unknown }>;
	getAiModel?: () => Promise<Record<string, never>>;
}): GenerateQuestionsDeps {
	return {
		getAiModel:
			overrides?.getAiModel ?? vi.fn(async () => ({}) as Record<string, never>),
		generateObject:
			overrides?.generateObject ??
			vi.fn(async () => ({
				object: makeValidQuestions(),
				usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
			})),
	};
}

describe("generateQuestions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns ok:true with questions array when LLM succeeds", async () => {
		const deps = makeDeps();
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.questions).toHaveLength(3);
		expect(result.usage).toBeDefined();
		expect(result.usage?.inputTokens).toBe(100);
	});

	it("returns ok:false with MODEL_UNAVAILABLE when getAiModel throws", async () => {
		const deps = makeDeps({
			getAiModel: vi.fn(async () => {
				throw new Error("model not available");
			}),
		});

		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.MODEL_UNAVAILABLE);
	});

	it("retries on transient errors (429) and succeeds on retry", async () => {
		const generateObject = vi
			.fn()
			.mockRejectedValueOnce({ status: 429, message: "rate limit" })
			.mockResolvedValueOnce({
				object: makeValidQuestions(),
				usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
			});

		const deps = makeDeps({ generateObject });
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.questions).toHaveLength(3);
		expect(generateObject).toHaveBeenCalledTimes(2);
	});

	it("retries on transient errors (5xx) and succeeds on retry", async () => {
		const generateObject = vi
			.fn()
			.mockRejectedValueOnce({ status: 503, message: "service unavailable" })
			.mockResolvedValueOnce({
				object: makeValidQuestions(),
				usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
			});

		const deps = makeDeps({ generateObject });
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.questions).toHaveLength(3);
		expect(generateObject).toHaveBeenCalledTimes(2);
	});

	it("retries on timeout errors and succeeds on retry", async () => {
		const generateObject = vi
			.fn()
			.mockRejectedValueOnce(new Error("timeout after 30s"))
			.mockResolvedValueOnce({
				object: makeValidQuestions(),
				usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
			});

		const deps = makeDeps({ generateObject });
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.questions).toHaveLength(3);
		expect(generateObject).toHaveBeenCalledTimes(2);
	});

	it("returns ok:false after exhausting retries on persistent errors", async () => {
		const generateObject = vi.fn().mockRejectedValue({
			status: 429,
			message: "rate limit",
		});

		const deps = makeDeps({ generateObject });
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.NO_VALID_QUESTIONS);
		// 1 initial + 2 retries = 3 total
		expect(generateObject).toHaveBeenCalledTimes(3);
	});

	it("returns ok:false when LLM returns empty questions array", async () => {
		const generateObject = vi.fn().mockResolvedValue({
			object: { questions: [] },
			usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
		});

		const deps = makeDeps({ generateObject });
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.NO_VALID_QUESTIONS);
	});

	it("logs LLM calls via logLlmCallStart/logLlmCallComplete on success", async () => {
		// The module-level mocks handle logging; verify the imported functions are called
		const deps = makeDeps();
		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(true);
		// logLlmCallStart and logLlmCallComplete are mocked at module level via vi.mock
		const { logLlmCallStart, logLlmCallComplete } = await import(
			"@/lib/llm-logging"
		);
		expect(logLlmCallStart).toHaveBeenCalledTimes(1);
		expect(logLlmCallStart).toHaveBeenCalledWith(
			expect.objectContaining({
				callType: "generate-exam-questions",
				model: metadata.modelId,
			}),
		);
		expect(logLlmCallComplete).toHaveBeenCalledTimes(1);
		expect(logLlmCallComplete).toHaveBeenCalledWith(
			"call-1",
			expect.objectContaining({ status: "success" }),
		);
	});

	it("logs LLM calls on error (after model resolution succeeds)", async () => {
		// When getAiModel succeeds but generateObject throws, logLlmCallStart is called
		const generateObject = vi
			.fn()
			.mockRejectedValue(new Error("generation failed"));
		const deps = makeDeps({ generateObject });

		const result = await generateQuestions(
			generationContext,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		const { logLlmCallStart, logLlmCallComplete } = await import(
			"@/lib/llm-logging"
		);
		expect(logLlmCallStart).toHaveBeenCalledTimes(1);
		expect(logLlmCallComplete).toHaveBeenCalledTimes(1);
		expect(logLlmCallComplete).toHaveBeenCalledWith(
			"call-1",
			expect.objectContaining({ status: "error" }),
		);
	});
});
