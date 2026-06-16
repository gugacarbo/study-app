import type { Espells } from "espells";
import { getPtBrSpellChecker } from "./instance";
import { tokenizeText } from "./tokenize";

export interface SpellIssue {
	word: string;
	suggestions: string[];
}

export interface SpellCheckResult {
	language: "pt-BR";
	checkedWordCount: number;
	issues: SpellIssue[];
}

const MAX_SUGGESTIONS = 5;

export async function checkTextSpelling(text: string): Promise<SpellCheckResult> {
	const spellChecker = await getPtBrSpellChecker();
	return checkTextWithSpellChecker(spellChecker, text);
}

export function checkTextWithSpellChecker(
	spellChecker: Espells,
	text: string,
): SpellCheckResult {
	const tokens = tokenizeText(text);
	const seenWords = new Set<string>();
	const issues: SpellIssue[] = [];

	for (const word of tokens) {
		const normalized = word.toLocaleLowerCase("pt-BR");
		if (seenWords.has(normalized)) continue;
		seenWords.add(normalized);

		const lookup = spellChecker.lookup(word, false);
		if (lookup.correct && !lookup.forbidden) continue;

		issues.push({
			word,
			suggestions: spellChecker.suggest(word, MAX_SUGGESTIONS),
		});
	}

	return {
		language: "pt-BR",
		checkedWordCount: seenWords.size,
		issues,
	};
}
