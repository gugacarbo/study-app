import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { examIngestResponseSchema } from "@/lib/validation";

const { chatMock } = vi.hoisted(() => ({
	chatMock: vi.fn(),
}));

vi.mock("@tanstack/ai", () => ({
	chat: chatMock,
}));

vi.mock("@/features/ai/adapters/provider-adapter", () => ({
	getAiAdapter: vi.fn(() => "mock-adapter"),
}));

import { generateJsonStream } from "@/features/ai/core/generate";

describe("generateJsonStream", () => {
	beforeEach(() => {
		chatMock.mockReset();
	});

	it("builds fallback JSON from delta chunks instead of accumulated content", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '{"name":"Jo',
					content: '{"name":"Jo',
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: 'hn"}',
					content: '{"name":"John"}',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({
				name: z.string(),
			}),
		);

		expect(result).toEqual({ name: "John" });
	});

	it("strips unclosed think tags and extracts JSON", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '<think>Let me reason about this...\nThe answer is:',
					content: '<think>Let me reason about this...\nThe answer is:',
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '\n{"name":"Alice"}',
					content: '\n{"name":"Alice"}',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Alice" });
	});

	it("extracts JSON from code fences in fallback", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: 'Here is the JSON:\n```json\n{"name":"Bob"}\n```\nDone.',
					content: 'Here is the JSON:\n```json\n{"name":"Bob"}\n```\nDone.',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Bob" });
	});

	it("repairs trailing commas in JSON before parsing", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '{"items":["a","b",],"name":"test",}',
					content: '{"items":["a","b",],"name":"test",}',
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ items: z.array(z.string()), name: z.string() }),
		);

		expect(result).toEqual({ items: ["a", "b"], name: "test" });
	});

	it("repairs single-quoted JSON keys in fallback", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "{'name':'Charlie'}",
					content: "{'name':'Charlie'}",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Charlie" });
	});

	it("includes detailed validation errors in thrown error message", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: '{"wrong_key":"value"}',
					content: '{"wrong_key":"value"}',
				};
			})(),
		);

		await expect(
			generateJsonStream(
				{
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "test-key",
					baseUrl: "",
				},
				"Return JSON",
				z.object({ name: z.string() }),
			),
		).rejects.toThrow(/Structured output stream ended/);
	});

	it("recovers from structured-output-parse-failed RUN_ERROR by extracting JSON from think-block content", async () => {
		// Reasoning models (DeepSeek R1, Qwen QwQ) emit `<think>...</think>`
		// inline with the final JSON. The TanStack AI library surfaces this
		// as a synthetic RUN_ERROR with code 'structured-output-parse-failed'
		// because JSON.parse() can't handle the leading think block. Our
		// code should treat that error as recoverable and try the fallback
		// JSON extractor on the accumulated text.
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "TEXT_MESSAGE_START",
					messageId: "m1",
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "<think>Let me analyze the questions carefully.\n",
					content: "<think>Let me analyze the questions carefully.\n",
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: 'I need to extract them as JSON.\n</think>\n{"name":"Recovered"}',
					content: 'I need to extract them as JSON.\n</think>\n{"name":"Recovered"}',
				};
				yield { type: "TEXT_MESSAGE_END", messageId: "m1" };
				yield {
					type: "CUSTOM",
					name: "structured-output.start",
					value: { messageId: "m1" },
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						'Failed to parse structured output as JSON. Content: <think>Let me analyze...',
					code: "structured-output-parse-failed",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "deepseek/deepseek-r1",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Recovered" });
	});

	it("recovers from structured-output-parse-failed RUN_ERROR when think-wrapped JSON arrives as reasoning chunks", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "REASONING_MESSAGE_CONTENT",
					delta: "<think>Let me analyze this carefully.\n",
				};
				yield {
					type: "REASONING_MESSAGE_CONTENT",
					delta: 'I will now return the object.\n</think>\n{"name":"Reasoned"}',
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						"Failed to parse structured output as JSON from reasoning content.",
					code: "structured-output-parse-failed",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "deepseek/deepseek-r1",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "Reasoned" });
	});

	it("recovers from parse-error RUN_ERROR when valid JSON text was already streamed", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "CUSTOM",
					name: "structured-output.start",
					value: { messageId: "m1" },
				};
				yield {
					type: "TEXT_MESSAGE_START",
					messageId: "m1",
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta:
						'{\n  "questions": [\n    {\n      "question": "Qual é a derivada de f(x) = x²?",\n      "options": ["1", "2x", "x²", "2"],\n      "answer": "2x",\n      "explanation": "A derivada de x² é 2x.",\n      "topic": "Derivadas"\n    }\n  ],\n  "topics": ["Derivadas"]\n}',
					content:
						'{\n  "questions": [\n    {\n      "question": "Qual é a derivada de f(x) = x²?",\n      "options": ["1", "2x", "x²", "2"],\n      "answer": "2x",\n      "explanation": "A derivada de x² é 2x.",\n      "topic": "Derivadas"\n    }\n  ],\n  "topics": ["Derivadas"]\n}',
				};
				yield { type: "TEXT_MESSAGE_END", messageId: "m1" };
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						'Failed to parse structured output as JSON. Content: { "questions": [...] }',
					code: "parse-error",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "some-provider/some-model",
				apiKey: "test-key",
				baseUrl: "",
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
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta:
						'"questions": [\n  {\n    "question": "Sobre os diferentes tipos de memória apresentados no conteúdo, assinale a alternativa correta.",\n    "options": [\n      "A memória RAM é classificada como armazenamento não volátil, destinado principalmente à persistência permanente de arquivos.",\n      "A cache L1 apresenta maior capacidade e menor velocidade que a memória RAM, pois fica mais distante da CPU.",\n      "A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",\n      "Na hierarquia de memórias, quanto mais próximo da base da pirâmide estiver um dispositivo, maior tende a ser sua velocidade e seu custo por byte.",\n      "Apenas registradores, caches e RAM podem ser considerados memórias; discos e unidades externas não entram nessa classificação."\n    ],\n    "answer": "A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",\n    "explanation": "",\n    "topic": "Hierarquia e função da memória"\n  }\n],\n"topics": [\n  "Hierarquia e função da memória"\n]\n}',
					content:
						'"questions": [\n  {\n    "question": "Sobre os diferentes tipos de memória apresentados no conteúdo, assinale a alternativa correta.",\n    "options": [\n      "A memória RAM é classificada como armazenamento não volátil, destinado principalmente à persistência permanente de arquivos.",\n      "A cache L1 apresenta maior capacidade e menor velocidade que a memória RAM, pois fica mais distante da CPU.",\n      "A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",\n      "Na hierarquia de memórias, quanto mais próximo da base da pirâmide estiver um dispositivo, maior tende a ser sua velocidade e seu custo por byte.",\n      "Apenas registradores, caches e RAM podem ser considerados memórias; discos e unidades externas não entram nessa classificação."\n    ],\n    "answer": "A memória principal funciona como espaço de trabalho do sistema, mantendo processos em execução, estruturas do núcleo e bibliotecas utilizadas durante a execução.",\n    "explanation": "",\n    "topic": "Hierarquia e função da memória"\n  }\n],\n"topics": [\n  "Hierarquia e função da memória"\n]\n}',
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						'Failed to parse structured output as JSON. Content: "questions": [...]',
					code: "parse-error",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "custom",
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
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "CUSTOM",
					name: "structured-output.start",
					value: { messageId: "m1" },
				};
				yield {
					type: "TEXT_MESSAGE_START",
					messageId: "m1",
				};
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta:
						'<think>\nVou extrair as questoes da prova e devolver JSON valido.\n1. Questao sobre conceito de E/S\n2. Questao sobre drivers\n"questions": [{"question":"O que e E/S mapeada em memoria?","options":["Mapeia registradores de dispositivo no espaco de enderecamento da memoria.","Usa apenas portas dedicadas de E/S.","Desativa interrupcoes do dispositivo.","E um tipo de memoria cache."],"answer":"Mapeia registradores de dispositivo no espaco de enderecamento da memoria.","explanation":"","topic":"Gerencia de E/S"}],"topics":["Gerencia de E/S"]}',
					content:
						'<think>\nVou extrair as questoes da prova e devolver JSON valido.\n1. Questao sobre conceito de E/S\n2. Questao sobre drivers\n"questions": [{"question":"O que e E/S mapeada em memoria?","options":["Mapeia registradores de dispositivo no espaco de enderecamento da memoria.","Usa apenas portas dedicadas de E/S.","Desativa interrupcoes do dispositivo.","E um tipo de memoria cache."],"answer":"Mapeia registradores de dispositivo no espaco de enderecamento da memoria.","explanation":"","topic":"Gerencia de E/S"}],"topics":["Gerencia de E/S"]}',
				};
				yield { type: "TEXT_MESSAGE_END", messageId: "m1" };
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						'Failed to parse structured output as JSON. Content: <think>..."questions": [...]',
					code: "parse-error",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "custom",
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
					answer:
						"Mapeia registradores de dispositivo no espaco de enderecamento da memoria.",
					explanation: "",
					topic: "Gerencia de E/S",
				},
			],
			topics: ["Gerencia de E/S"],
		});
	});

	it("normalizes open-ended ingest questions after think-block fallback parsing", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta:
						'<think>Analisando a prova dissertativa.</think>{"questions":[{"question":"Explique o modelo OSI.","options":[],"answer":"O modelo OSI possui sete camadas.","explanation":"","topic":"Redes"}],"topics":["Redes"]}',
					content:
						'<think>Analisando a prova dissertativa.</think>{"questions":[{"question":"Explique o modelo OSI.","options":[],"answer":"O modelo OSI possui sete camadas.","explanation":"","topic":"Redes"}],"topics":["Redes"]}',
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message:
						"Failed to parse structured output as JSON. Content: <think>...",
					code: "parse-error",
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "custom",
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
					answer: "O modelo OSI possui sete camadas.",
					explanation: "",
					topic: "Redes",
				},
			],
			topics: ["Redes"],
		});
	});

	it("throws when structured-output-parse-failed RUN_ERROR has no recoverable JSON", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield { type: "RUN_STARTED", runId: "r1" };
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "<think>I refuse to answer as JSON</think>",
					content: "<think>I refuse to answer as JSON</think>",
				};
				yield {
					type: "RUN_ERROR",
					runId: "r1",
					message: "Failed to parse structured output as JSON.",
					code: "structured-output-parse-failed",
				};
			})(),
		);

		await expect(
			generateJsonStream(
				{
					provider: "openrouter",
					model: "deepseek/deepseek-r1",
					apiKey: "test-key",
					baseUrl: "",
				},
				"Return JSON",
				z.object({ name: z.string() }),
			),
		).rejects.toThrow(/Structured output stream ended/);
	});

	it("returns structured output when complete event is received", async () => {
		chatMock.mockReturnValue(
			(async function* () {
				yield {
					type: "TEXT_MESSAGE_CONTENT",
					delta: "some text",
					content: "some text",
				};
				yield {
					type: "CUSTOM",
					name: "structured-output.complete",
					value: { object: { name: "DirectResult" } },
				};
			})(),
		);

		const result = await generateJsonStream(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
				baseUrl: "",
			},
			"Return JSON",
			z.object({ name: z.string() }),
		);

		expect(result).toEqual({ name: "DirectResult" });
	});
});
