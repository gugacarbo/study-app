import { describe, expect, it } from "vitest";
import type { GenerateExamJobMetadata } from "@/lib/job-kinds";
import { buildGenerationContext } from "./build-generation-context";
import {
	type ParsedContextDocument,
	parsedContextDocumentSchema,
} from "./parser-schema";
import type { GenerateExamRawContext } from "./types";

function makeRawContext(): GenerateExamRawContext {
	return {
		mainContentFileId: "00000000-0000-4000-8000-000000000601",
		mainContent: "Conteúdo base.",
		contextFiles: [
			{
				fileId: "00000000-0000-4000-8000-000000000602",
				fileName: "contexto.md",
				text: "Contexto adicional.",
			},
		],
	};
}

function makeDocument(): ParsedContextDocument {
	return {
		schemaVersion: "1",
		sourceFileId: "00000000-0000-4000-8000-000000000602",
		title: "Contexto",
		documentType: "notes",
		summary: "Resumo.",
		rawText: "Contexto adicional.",
		sections: [
			{
				id: "sec-1",
				title: "Seção",
				level: 1,
				summary: "Resumo.",
				topicRefs: ["topic-1"],
				keyPoints: ["Ponto."],
				sourceSpan: { sectionLabel: "Seção", excerpt: "Texto." },
				confidence: "high",
			},
		],
		topics: [
			{
				id: "topic-1",
				name: "Tópico",
				summary: "Resumo.",
				keywords: ["kw"],
				sectionRefs: ["sec-1"],
				sourceSpans: [{ sectionLabel: "Seção", excerpt: "Texto." }],
				confidence: "high",
			},
		],
		facts: [],
		studyObjectives: [],
		glossary: [],
		warnings: [],
	};
}

function makeMetadata(
	overrides?: Partial<GenerateExamJobMetadata>,
): GenerateExamJobMetadata {
	return {
		examId: "00000000-0000-4000-8000-000000000201",
		modelId: "model-1",
		questionCount: 5,
		difficulty: "medium",
		...overrides,
	};
}

describe("buildGenerationContext", () => {
	it("consolidates mainContent, parsed documents and metadata", () => {
		const rawContext = makeRawContext();
		const document = makeDocument();
		const metadata = makeMetadata({ difficultyNotes: "Foco em conceitos." });

		const result = buildGenerationContext(rawContext, [document], metadata);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.context.mainContent).toBe("Conteúdo base.");
		expect(result.context.parsedContextDocuments).toHaveLength(1);
		expect(result.context.questionCount).toBe(5);
		expect(result.context.difficulty).toBe("medium");
		expect(result.context.difficultyNotes).toBe("Foco em conceitos.");
	});

	it("fails when questionCount is out of range", () => {
		const rawContext = makeRawContext();
		const metadata = makeMetadata({ questionCount: 21 });

		const result = buildGenerationContext(rawContext, [], metadata);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("questionCount inválido");
	});

	it("fails when difficulty is invalid", () => {
		const rawContext = makeRawContext();
		const metadata = makeMetadata({ difficulty: "impossible" as "medium" });

		const result = buildGenerationContext(rawContext, [], metadata);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("difficulty inválido");
	});

	it("uses parserSchema as reference type for documents", () => {
		const document = makeDocument();
		const parsed = parsedContextDocumentSchema.safeParse(document);
		expect(parsed.success).toBe(true);
	});
});
