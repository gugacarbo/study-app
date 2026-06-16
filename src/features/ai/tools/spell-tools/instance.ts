import type { Espells } from "espells";

let spellCheckerPromise: Promise<Espells> | null = null;

export function getPtBrSpellChecker(): Promise<Espells> {
	if (!spellCheckerPromise) {
		spellCheckerPromise = loadPtBrSpellChecker();
	}
	return spellCheckerPromise;
}

/** Preloads the pt-BR dictionary so the first tool call is fast. */
export const warmPtBrSpellChecker = getPtBrSpellChecker;

async function loadPtBrSpellChecker(): Promise<Espells> {
	const [{ Espells }, affModule, dicModule] = await Promise.all([
		import("espells"),
		import("../../../../../node_modules/dictionary-pt/index.aff?raw"),
		import("../../../../../node_modules/dictionary-pt/index.dic?raw"),
	]);

	return new Espells({
		aff: affModule.default,
		dic: dicModule.default,
	});
}

/** Resets the cached checker — for tests only. */
export function resetPtBrSpellCheckerForTests(): void {
	spellCheckerPromise = null;
}
