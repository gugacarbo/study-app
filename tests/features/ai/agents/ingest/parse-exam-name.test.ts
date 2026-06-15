import { describe, expect, it } from "vitest";
import { parseExamNameFromFileName } from "@/features/ai/agents/ingest/parse-exam-name";

describe("parseExamNameFromFileName", () => {
	it("removes extension and normalizes separators", () => {
		expect(parseExamNameFromFileName("ENEM_2023_Linguagens.pdf")).toBe(
			"ENEM 2023 Linguagens",
		);
		expect(parseExamNameFromFileName("prova-redes-2024.txt")).toBe(
			"prova redes 2024",
		);
	});

	it("uses only the basename when a path is provided", () => {
		expect(parseExamNameFromFileName("/uploads/2024/prova-final.pdf")).toBe(
			"prova final",
		);
	});

	it("falls back safely for empty or whitespace names", () => {
		expect(parseExamNameFromFileName("")).toBe("Untitled exam");
		expect(parseExamNameFromFileName("   ")).toBe("Untitled exam");
	});
});
