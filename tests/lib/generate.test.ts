import type { ObjectStreamPart, StreamObjectResult } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { examIngestResponseSchema } from "@/lib/validation";

const { streamObjectMock } = vi.hoisted(() => ({
	streamObjectMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return {
		...actual,
		streamObject: streamObjectMock,
	};
});

vi.mock("@/features/ai/adapters/provider-model", () => ({
	getAiModel: vi.fn(() => "mock-model"),
}));

import { generateJsonStream } from "@/features/ai/core/generate";

function createRecoverableError(message: string, code: string) {
	return Object.assign(new Error(message), { code });
}

function mockStreamObjectResult<T>(
	parts: ObjectStreamPart<unknown>[],
	objectResult: Promise<T | undefined> | T | undefined = undefined,
) {
	const object =
		objectResult instanceof Promise
			? objectResult
			: Promise.resolve(objectResult);

	streamObjectMock.mockReturnValue({
		fullStream: (async function* () {
			for (const part of parts) {
				yield part;
			}
		})(),
		textStream: (async function* () {
			for (const part of parts) {
				if (part.type === "text-delta") {
					yield part.textDelta;
				}
			}
		})(),
		partialObjectStream: (async function* () {
			for (const part of parts) {
				if (part.type === "object") {
					yield part.object;
				}
			}
		})(),
		object,
		usage: Promise.resolve({
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			inputTokenDetails: {
				noCacheTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			},
			outputTokenDetails: {
				textTokens: 0,
				reasoningTokens: 0,
			},
		}),
		warnings: Promise.resolve(undefined),
		providerMetadata: Promise.resolve(undefined),
		request: Promise.resolve({}),
		response: Promise.resolve({
			id: "mock-response",
			timestamp: new Date(),
			modelId: "mock-model",
		}),
		finishReason: Promise.resolve("stop" as const),
		elementStream: undefined,
		pipeTextStreamToResponse: vi.fn(),
		toTextStreamResponse: vi.fn(() => new Response()),
	} as unknown as StreamObjectResult<unknown, T, never>);
}

describe("generateJsonStream", () => {
	beforeEach(() => {
		streamObjectMock.mockReset();
	});

	it("builds fallback JSON from delta chunks instead of accumulated content", async () => {
		mockStreamObjectResult([
			{ type: "text-delta", textDelta: '{"name":"Jo' },
			{ type: "text-delta", textDelta: 'hn"}' },
		]);

		const result = await generateJsonStream(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Return JSON",
			z.object({
				name: z.string(),
			}),
		);

		expect(result).toEqual({ name: "John" });
	});

	it("strips unclosed think tags and extracts JSON", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta:
					'<think>Let me reason about this...\nThe answer is:',
			},
			{
				type: "text-delta",
				textDelta: '\n{"name":"Alice"}',
			},
		]);

		const result = await generateJsonStream(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Alice" });
	});

	it("extracts JSON from code fences in fallback", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: 'Here is the JSON:\n```json\n{"name":"Bob"}\n```\nDone.',
			},
		]);

		const result = await generateJsonStream(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Bob" });
	});

	it("repairs trailing commas in JSON before parsing", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: '{"items":["a","b",],"name":"test",}',
			},
		]);

		const result = await generateJsonStream(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Return JSON",
			z.object({ items: z.array(z.string()), name: z.string() }),
		);

		expect(result).toEqual({ items: ["a", "b"], name: "test" });
	});

	it("repairs single-quoted JSON keys in fallback", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: "{'name':'Charlie'}",
			},
		]);

		const result = await generateJsonStream(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Charlie" });
	});

	it("includes detailed validation errors in thrown error message", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: '{"wrong_key":"value"}',
			},
		]);

		await expect(
			generateJsonStream(
				{
					model: "openai/gpt-4o-mini",
					baseUrl: "https://openrouter.ai/api/v1",
					apiKey: "test-key",
				},
				"Return JSON",
				z.object({ name: z.string() }),
			),
		).rejects.toThrow(/Structured output stream ended/);
	});

	it("recovers from structured-output-parse-failed RUN_ERROR by extracting JSON from think-block content", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: "<think>Let me analyze the questions carefully.\n",
			},
			{
				type: "text-delta",
				textDelta:
					'I need to extract them as JSON.\n</think>\n{"name":"Recovered"}',
			},
			{
				type: "error",
				error: createRecoverableError(
					"Failed to parse structured output as JSON. Content: <think>Let me analyze...",
					"structured-output-parse-failed",
				),
			},
		]);

		const result = await generateJsonStream(
			{
				model: "deepseek/deepseek-r1",
				apiKey: "test-key",
				baseUrl: "https://openrouter.ai/api/v1",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Recovered" });
	});

	it("recovers from structured-output-parse-failed RUN_ERROR when think-wrapped JSON arrives as reasoning chunks", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: "<think>Let me analyze this carefully.\n",
			},
			{
				type: "text-delta",
				textDelta:
					'I will now return the object.\n</think>\n{"name":"Reasoned"}',
			},
			{
				type: "error",
				error: createRecoverableError(
					"Failed to parse structured output as JSON from reasoning content.",
					"structured-output-parse-failed",
				),
			},
		]);

		const result = await generateJsonStream(
			{
				model: "deepseek/deepseek-r1",
				apiKey: "test-key",
				baseUrl: "https://openrouter.ai/api/v1",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Reasoned" });
	});

	it("recovers from parse-error RUN_ERROR when valid JSON text was already streamed", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta:
					'{\n  "questions": [\n    {\n      "question": "Qual é a derivada de f(x) = x²?",\n      "options": ["1", "2x", "x²", "2"],\n      "answer": "2x",\n      "explanation": "A derivada de x² é 2x.",\n      "topic": "Derivadas"\n    }\n  ],\n  "topics": ["Derivadas"]\n}',
			},
			{
				type: "error",
				error: createRecoverableError(
					'Failed to parse structured output as JSON. Content: { "questions": [...] }',
					"parse-error",
				),
			},
		]);

		const result = await generateJsonStream(
			{
				model: "some-provider/some-model",
				apiKey: "test-key",
				baseUrl: "https://openrouter.ai/api/v1",
			},
			"Return JSON",
			z.object({
				questions: z.array(
					z.object({
						question: z.string(),
						options: z.array(z.string()),
						answer: z.string(),
						explanation: z.string(),
						topic: z.string(),
					}),
				),
				topics: z.array(z.string()),
			}),
		);

		expect(result).toEqual({
			questions: [
				{
					question: "Qual é a derivada de f(x) = x²?",
					options: ["1", "2x", "x²", "2"],
					answer: "2x",
					explanation: "A derivada de x² é 2x.",
					topic: "Derivadas",
				},
			],
			topics: ["Derivadas"],
		});
	});

	it("repairs streamed object bodies that are missing the opening brace", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta:
					'"questions": [\n  {\n    "question": "Sobre os diferentes tipos de memória apresentados no conteúdo, assinale a alternativa correta.",\n    "options": [\n      "A memória RAM é classificada como armazenamento não volátil, destinado principalmente à persistência permanente de arquivos.",\n      "A cache L1 apresenta maior capacidade e menor velocidade que a memória RAM, pois fica mais distante da CPU.",\n      "A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",\n      "Na hierarquia de memórias, quanto mais próximo da base da pirâmide estiver um dispositivo, maior tende a ser sua velocidade e seu custo por byte.",\n      "Apenas registradores, caches e RAM podem ser considerados memórias; discos e unidades externas não entram nessa classificação."\n    ],\n    "answer": "A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",\n    "explanation": "",\n    "topic": "Hierarquia e função da memória"\n  }\n],\n"topics": [\n  "Hierarquia e função da memória"\n]\n}',
			},
			{
				type: "error",
				error: createRecoverableError(
					'Failed to parse structured output as JSON. Content: "questions": [...]',
					"parse-error",
				),
			},
		]);

		const result = await generateJsonStream(
			{
				model: "glm-5.1:ollama",
				apiKey: "test-key",
				baseUrl: "http://localhost:11434",
			},
			"Return JSON",
			z.object({
				questions: z.array(
					z.object({
						question: z.string(),
						options: z.array(z.string()),
						answer: z.string(),
						explanation: z.string(),
						topic: z.string(),
					}),
				),
				topics: z.array(z.string()),
			}),
		);

		expect(result).toEqual({
			questions: [
				{
					question:
						"Sobre os diferentes tipos de memória apresentados no conteúdo, assinale a alternativa correta.",
					options: [
						"A memória RAM é classificada como armazenamento não volátil, destinado principalmente à persistência permanente de arquivos.",
						"A cache L1 apresenta maior capacidade e menor velocidade que a memória RAM, pois fica mais distante da CPU.",
						"A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",
						"Na hierarquia de memórias, quanto mais próximo da base da pirâmide estiver um dispositivo, maior tende a ser sua velocidade e seu custo por byte.",
						"Apenas registradores, caches e RAM podem ser considerados memórias; discos e unidades externas não entram nessa classificação.",
					],
					answer:
						"A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",
					explanation: "",
					topic: "Hierarquia e função da memória",
				},
			],
			topics: ["Hierarquia e função da memória"],
		});
	});

	it("recovers when an unclosed think block precedes an object body missing the opening brace", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta:
					'<think>\nVou extrair as questoes da prova e devolver JSON valido.\n1. Questao sobre conceito de E/S\n2. Questao sobre drivers\n"questions": [{"question":"O que e E/S mapeada em memoria?","options":["Mapeia registradores de dispositivo no espaco de enderecamento da memoria.","Usa apenas portas dedicadas de E/S.","Desativa interrupcoes do dispositivo.","E um tipo de memoria cache."],"answer":"Mapeia registradores de dispositivo no espaco de enderecamento da memoria.","explanation":"","topic":"Gerencia de E/S"}],"topics":["Gerencia de E/S"]}',
			},
			{
				type: "error",
				error: createRecoverableError(
					'Failed to parse structured output as JSON. Content: <think>..."questions": [...]',
					"parse-error",
				),
			},
		]);

		const result = await generateJsonStream(
			{
				model: "MiniMax-M2.7-highspeed",
				apiKey: "test-key",
				baseUrl: "https://example.com/v1",
			},
			"Return JSON",
			examIngestResponseSchema,
		);

		expect(result).toEqual({
			questions: [
				{
					question: "O que e E/S mapeada em memoria?",
					options: [
						"Mapeia registradores de dispositivo no espaco de enderecamento da memoria.",
						"Usa apenas portas dedicadas de E/S.",
						"Desativa interrupcoes do dispositivo.",
						"E um tipo de memoria cache.",
					],
					answers: [
						"Mapeia registradores de dispositivo no espaco de enderecamento da memoria.",
					],
					scoringMode: "exact",
					explanation: "",
					deepExplanation: undefined,
					topic: "Gerencia de E/S",
				},
			],
			topics: ["Gerencia de E/S"],
		});
	});

	it("normalizes open-ended ingest questions after think-block fallback parsing", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta:
					'<think>Analisando a prova dissertativa.</think>{"questions":[{"question":"Explique o modelo OSI.","options":[],"answer":"O modelo OSI possui sete camadas.","explanation":"","topic":"Redes"}],"topics":["Redes"]}',
			},
			{
				type: "error",
				error: createRecoverableError(
					"Failed to parse structured output as JSON. Content: <think>...",
					"parse-error",
				),
			},
		]);

		const result = await generateJsonStream(
			{
				model: "MiniMax-M2.7-highspeed",
				apiKey: "test-key",
				baseUrl: "https://example.com/v1",
			},
			"Return JSON",
			examIngestResponseSchema,
		);

		expect(result).toEqual({
			questions: [
				{
					question: "Explique o modelo OSI.",
					options: [
						"O modelo OSI possui sete camadas.",
						"Resposta incorreta.",
					],
					answers: ["O modelo OSI possui sete camadas."],
					scoringMode: "exact",
					explanation: "",
					deepExplanation: undefined,
					topic: "Redes",
				},
			],
			topics: ["Redes"],
		});
	});

	it("throws when structured-output-parse-failed RUN_ERROR has no recoverable JSON", async () => {
		mockStreamObjectResult([
			{
				type: "text-delta",
				textDelta: "<think>I refuse to answer as JSON</think>",
			},
			{
				type: "error",
				error: createRecoverableError(
					"Failed to parse structured output as JSON.",
					"structured-output-parse-failed",
				),
			},
		]);

		await expect(
			generateJsonStream(
				{
					model: "deepseek/deepseek-r1",
					apiKey: "test-key",
					baseUrl: "https://openrouter.ai/api/v1",
				},
				"Return JSON",
				z.object({ name: z.string() }),
			),
		).rejects.toThrow(/Structured output stream ended/);
	});

	it("returns structured output when complete event is received", async () => {
		mockStreamObjectResult(
			[
				{ type: "text-delta", textDelta: "some text" },
				{ type: "object", object: { name: "DirectResult" } },
			],
			{ name: "DirectResult" },
		);

		const result = await generateJsonStream(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "DirectResult" });
	});
});
