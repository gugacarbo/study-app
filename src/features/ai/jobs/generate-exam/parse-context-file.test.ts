import { zodSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import { parseContextFile } from "./parse-context-file";
import type { GetAiModelLike } from "./parse-context-file";
import {
	type ParsedContextDocument,
	parsedContextDocumentSchema,
} from "./parser-schema";
import type { GenerateExamContextFile } from "./types";

vi.mock("@/lib/llm-logging", () => ({
	createLlmLogCallId: vi.fn(() => "call-1"),
	logLlmCallStart: vi.fn(async () => undefined),
	logLlmCallComplete: vi.fn(async () => undefined),
}));

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({}) as never),
}));

const userId = "00000000-0000-4000-8000-000000000401";
const modelId = "00000000-0000-4000-8000-000000000501";

const metadata = {
	examId: "00000000-0000-4000-8000-000000000201",
	modelId,
	questionCount: 5,
	difficulty: "medium" as const,
};

function makeValidParsedDocument(fileId: string): ParsedContextDocument {
	return {
		schemaVersion: "1",
		sourceFileId: fileId,
		title: "Documento de contexto",
		documentType: "notes",
		summary: "Resumo didático.",
		rawText: "Texto bruto do arquivo.",
		sections: [
			{
				id: "sec-1",
				title: "Seção 1",
				level: 1,
				summary: "Resumo da seção.",
				topicRefs: ["topic-1"],
				keyPoints: ["Ponto chave."],
				sourceSpan: { sectionLabel: "Seção 1", excerpt: "Texto." },
				confidence: "high",
			},
		],
		topics: [
			{
				id: "topic-1",
				name: "Tópico 1",
				summary: "Resumo do tópico.",
				keywords: ["palavra"],
				sectionRefs: ["sec-1"],
				sourceSpans: [{ sectionLabel: "Seção 1", excerpt: "Texto." }],
				confidence: "high",
			},
		],
		facts: [
			{
				statement: "Fato importante.",
				importance: "high",
				topicRefs: ["topic-1"],
				sourceSpan: { sectionLabel: "Seção 1", excerpt: "Texto." },
				confidence: "high",
			},
		],
		studyObjectives: [
			{
				description: "Objetivo de estudo.",
				topicRefs: ["topic-1"],
				sourceSpan: { sectionLabel: "Seção 1", excerpt: "Texto." },
				confidence: "high",
			},
		],
		glossary: [
			{
				term: "termo",
				definition: "definição do termo.",
				topicRefs: ["topic-1"],
				sourceSpan: { sectionLabel: "Seção 1", excerpt: "Texto." },
				confidence: "high",
			},
		],
		warnings: [],
	};
}

function makeFile(): GenerateExamContextFile {
	return {
		fileId: "00000000-0000-4000-8000-000000000601",
		fileName: "contexto.md",
		text: "Texto bruto do arquivo de contexto.",
	};
}

function makeDeps(overrides?: {
	generateObject?: (
		options: object,
	) => Promise<{ object: unknown; usage?: unknown }>;
	getAiModel?: GetAiModelLike;
}) {
	return {
		getAiModel:
			overrides?.getAiModel ??
			(vi.fn(async () => ({})) as unknown as GetAiModelLike),
		generateObject:
			overrides?.generateObject ??
			vi.fn(async () => ({
				object: makeValidParsedDocument(makeFile().fileId),
				usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
			})),
	};
}

describe("parseContextFile", () => {
	it("validates LLM output against parser schema and overrides sourceFileId", async () => {
		const file = makeFile();
		const deps = makeDeps({
			generateObject: vi.fn(async () => ({
				object: makeValidParsedDocument(file.fileId),
			})),
		});

		const result = await parseContextFile(
			file,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.document.sourceFileId).toBe(file.fileId);
		expect(result.document.schemaVersion).toBe("1");
	});

	it("returns terminal failure on invalid JSON shape", async () => {
		const file = makeFile();
		const deps = makeDeps({
			generateObject: vi.fn(async () => ({
				object: { invalid: true },
			})),
		});

		const result = await parseContextFile(
			file,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.INVALID_CONTEXT_PARSE);
	});

	it("returns terminal failure when generateObject throws", async () => {
		const file = makeFile();
		const deps = makeDeps({
			generateObject: vi.fn(async () => {
				throw new Error("model error");
			}),
		});

		const result = await parseContextFile(
			file,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.CONTEXT_PARSE_FAILED);
	});

	it("returns terminal failure when model resolution fails", async () => {
		const file = makeFile();
		const deps = makeDeps({
			getAiModel: vi.fn(async () => {
				throw new Error("model unavailable");
			}),
		});

		const result = await parseContextFile(
			file,
			metadata,
			userId,
			{} as never,
			deps,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.terminal.error).toBe(JOB_ERROR_CODE.MODEL_UNAVAILABLE);
	});

	it("uses zodSchema over parserSchema so generated types can be asserted", () => {
		const schema = zodSchema(parsedContextDocumentSchema);
		expect(schema).toBeDefined();
	});
});
