import { describe, expect, it } from "vitest";
import { tokenizeText } from "@/features/ai/tools/spell-tools/tokenize";

describe("tokenizeText", () => {
	it("extracts Portuguese words with accents", () => {
		expect(tokenizeText("Qual é a capital?")).toEqual(["Qual", "capital"]);
	});

	it("ignores numbers, short tokens, and URLs", () => {
		expect(
			tokenizeText("Veja https://example.com e 42 itens de A para B"),
		).toEqual(["Veja", "itens", "para"]);
	});

	it("returns an empty array for text without eligible tokens", () => {
		expect(tokenizeText("42 https://example.com a b")).toEqual([]);
	});
});
