import { describe, expect, it, vi } from "vitest";
import type { ParsedContextDocument } from "./parser-schema";
import { storeParsedArtifact } from "./store-parsed-artifact";

const userId = "00000000-0000-4000-8000-000000000401";

function makeDocument(): ParsedContextDocument {
	return {
		schemaVersion: "1",
		sourceFileId: "00000000-0000-4000-8000-000000000601",
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
		facts: [],
		studyObjectives: [],
		glossary: [],
		warnings: [],
	};
}

describe("storeParsedArtifact", () => {
	it("persists JSON artifact in R2 and returns artifact id/key", async () => {
		const put = vi.fn(async () => undefined);
		const bucket = { put } as unknown as Parameters<
			typeof storeParsedArtifact
		>[0];
		const document = makeDocument();

		const result = await storeParsedArtifact(bucket, userId, document);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.artifactFileId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		expect(result.r2Key).toContain("parsed-artifact.json");
		expect(result.r2Key).toContain(userId);

		const putBody = put.mock.calls[0]?.[1] as string;
		const parsed = JSON.parse(putBody);
		expect(parsed.sourceFileId).toBe(document.sourceFileId);
		expect(parsed.schemaVersion).toBe("1");
		expect(parsed.sections).toHaveLength(1);
	});

	it("returns failure when R2 put throws", async () => {
		const bucket = {
			put: vi.fn(async () => {
				throw new Error("r2 failure");
			}),
		} as unknown as Parameters<typeof storeParsedArtifact>[0];
		const document = makeDocument();

		const result = await storeParsedArtifact(bucket, userId, document);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("r2 failure");
	});
});
