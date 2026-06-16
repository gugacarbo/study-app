import { beforeAll, describe, expect, it } from "vitest";
import type { Espells } from "espells";
import { checkTextWithSpellChecker } from "@/features/ai/tools/spell-tools/check-text";
import { getPtBrSpellChecker } from "@/features/ai/tools/spell-tools/instance";

describe("checkTextWithSpellChecker", () => {
	let spellChecker: Espells;

	beforeAll(async () => {
		spellChecker = await getPtBrSpellChecker();
	}, 30_000);

	it("flags misspelled words and suggests corrections", () => {
		const result = checkTextWithSpellChecker(spellChecker, "ortogafia");

		expect(result.language).toBe("pt-BR");
		expect(result.checkedWordCount).toBe(1);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]?.word).toBe("ortogafia");
		expect(result.issues[0]?.suggestions).toContain("ortografia");
	});

	it("accepts correctly spelled Portuguese words", () => {
		const result = checkTextWithSpellChecker(spellChecker, "ortografia");

		expect(result.issues).toEqual([]);
	});
});
