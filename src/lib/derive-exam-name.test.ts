import { describe, expect, it } from "vitest";
import {
	INGEST_PENDING_EXAM_NAME,
	deriveExamNameFromFilename,
} from "@/lib/derive-exam-name";

describe("deriveExamNameFromFilename", () => {
	it("strips extension and normalizes separators", () => {
		expect(deriveExamNameFromFilename("calculo_i-p1_2025.md")).toBe(
			"Calculo i p1 2025",
		);
	});

	it("preserves existing capitalization after the first character", () => {
		expect(deriveExamNameFromFilename("Prova de Cálculo.txt")).toBe(
			"Prova de Cálculo",
		);
	});

	it("uses basename when a path is provided", () => {
		expect(deriveExamNameFromFilename("/tmp/exams/prova_final.md")).toBe(
			"Prova final",
		);
	});

	it("falls back when the basename is empty after normalization", () => {
		expect(deriveExamNameFromFilename("---.txt")).toBe(INGEST_PENDING_EXAM_NAME);
	});
});
