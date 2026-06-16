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
	truncated: boolean;
}

const MAX_SUGGESTIONS = 5;
const MAX_TOKENS = 150;
const MAX_ISSUES = 25;

function stripDiacritics(value: string): string {
	return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function shouldSkipSpellToken(word: string): boolean {
	return word.length > 2 && word === word.toUpperCase() && /[A-Z]/.test(word);
}

function isAccentOnlyVariant(word: string, suggestion: string): boolean {
	const baseWord = stripDiacritics(word).toLocaleLowerCase("pt-BR");
	const baseSuggestion = stripDiacritics(suggestion).toLocaleLowerCase("pt-BR");
	if (baseWord !== baseSuggestion || word === suggestion) return false;

	return (
		stripDiacritics(word) !== word || stripDiacritics(suggestion) !== suggestion
	);
}

function isCorrectSpelling(spellChecker: Espells, word: string): boolean {
	const lookup = spellChecker.lookup(word, false);
	if (lookup.correct && !lookup.forbidden) return true;

	const lower = word.toLocaleLowerCase("pt-BR");
	if (lower !== word) {
		const lowerLookup = spellChecker.lookup(lower, false);
		if (lowerLookup.correct && !lowerLookup.forbidden) return true;
	}

	return false;
}

function findMissingAccentIssue(
	spellChecker: Espells,
	word: string,
): SpellIssue | null {
	if (stripDiacritics(word) !== word) return null;

	const suggestions = spellChecker.suggest(word, MAX_SUGGESTIONS);
	const accented = suggestions.find((suggestion) =>
		isAccentOnlyVariant(word, suggestion),
	);
	if (!accented) return null;

	return {
		word,
		suggestions: [
			accented,
			...suggestions.filter((suggestion) => suggestion !== accented),
		].slice(0, MAX_SUGGESTIONS),
	};
}

export async function checkTextSpelling(
	text: string,
): Promise<SpellCheckResult> {
	const spellChecker = await getPtBrSpellChecker();
	return checkTextWithSpellChecker(spellChecker, text);
}

export function checkTextWithSpellChecker(
	spellChecker: Espells,
	text: string,
): SpellCheckResult {
	const tokens = tokenizeText(text).slice(0, MAX_TOKENS);
	const seenWords = new Set<string>();
	const issues: SpellIssue[] = [];
	let truncated = tokens.length >= MAX_TOKENS;

	for (const word of tokens) {
		if (issues.length >= MAX_ISSUES) {
			truncated = true;
			break;
		}

		const normalized = word.toLocaleLowerCase("pt-BR");
		if (seenWords.has(normalized)) continue;
		if (shouldSkipSpellToken(word)) continue;
		seenWords.add(normalized);

		if (isCorrectSpelling(spellChecker, word)) {
			const accentIssue = findMissingAccentIssue(spellChecker, word);
			if (accentIssue) {
				issues.push(accentIssue);
			}
			continue;
		}

		issues.push({
			word,
			suggestions: spellChecker.suggest(word, MAX_SUGGESTIONS),
		});
	}

	return {
		language: "pt-BR",
		checkedWordCount: seenWords.size,
		issues,
		truncated,
	};
}
