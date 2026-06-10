import type { Question } from "@/lib/validation";

const DEFAULT_MAX_SNIPPET = 4_000;
const MIN_PADDING = 120;
const MAX_PADDING = 500;

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function buildSearchNeedles(
	question: Pick<Question, "question" | "options" | "answers">,
): string[] {
	const needles: string[] = [];
	const stem = normalizeWhitespace(question.question);

	if (stem.length > 0) {
		needles.push(stem.length > 120 ? stem.slice(0, 120) : stem);
	}

	for (const option of question.options) {
		const normalized = normalizeWhitespace(option);
		if (normalized.length >= 12) {
			needles.push(normalized);
		}
	}

	for (const answer of question.answers) {
		const normalizedAnswer = normalizeWhitespace(answer);
		if (
			normalizedAnswer.length >= 4 &&
			!/^[A-E]$/i.test(normalizedAnswer)
		) {
			needles.push(normalizedAnswer);
		}
	}

	return [...new Set(needles)].sort(
		(left, right) => right.length - left.length,
	);
}

function findBestMatch(
	sourceText: string,
	needles: string[],
): { index: number; length: number } | null {
	const lowerSource = sourceText.toLowerCase();
	let bestIndex = -1;
	let bestLength = 0;

	for (const needle of needles) {
		const index = lowerSource.indexOf(needle.toLowerCase());
		if (index >= 0 && needle.length > bestLength) {
			bestIndex = index;
			bestLength = needle.length;
		}
	}

	if (bestIndex < 0) {
		return null;
	}

	return { index: bestIndex, length: bestLength };
}

function resolveSnippetBounds(
	sourceText: string,
	matchIndex: number,
	matchLength: number,
	maxLength: number,
): { start: number; end: number } {
	const matchEnd = matchIndex + matchLength;
	let start = Math.max(0, matchIndex - MIN_PADDING);
	let end = Math.min(sourceText.length, matchEnd + MIN_PADDING);

	const previousBreak = sourceText.lastIndexOf("\n\n", matchIndex);
	if (previousBreak >= 0 && matchIndex - previousBreak <= MAX_PADDING) {
		start = previousBreak + 2;
	} else {
		start = Math.max(0, matchIndex - MAX_PADDING);
	}

	const nextBreak = sourceText.indexOf("\n\n", matchEnd);
	if (nextBreak >= 0 && nextBreak - matchEnd <= MAX_PADDING) {
		end = nextBreak;
	} else {
		end = Math.min(sourceText.length, matchEnd + MAX_PADDING);
	}

	if (end - start <= maxLength) {
		return { start, end };
	}

	const matchCenter = matchIndex + matchLength / 2;
	const half = Math.floor(maxLength / 2);
	start = Math.max(0, Math.floor(matchCenter - half));
	end = Math.min(sourceText.length, start + maxLength);
	if (end - start < maxLength) {
		start = Math.max(0, end - maxLength);
	}

	return { start, end };
}

export function extractQuestionSourceSnippet(
	sourceText: string,
	question: Pick<Question, "question" | "options" | "answers">,
	options?: { maxLength?: number },
): string {
	const trimmedSource = sourceText.trim();
	if (!trimmedSource) return "";

	const maxLength = options?.maxLength ?? DEFAULT_MAX_SNIPPET;
	const match = findBestMatch(trimmedSource, buildSearchNeedles(question));
	if (!match) {
		return "";
	}

	const { start, end } = resolveSnippetBounds(
		trimmedSource,
		match.index,
		match.length,
		maxLength,
	);

	let snippet = trimmedSource.slice(start, end).trim();
	if (start > 0) {
		snippet = `…${snippet}`;
	}
	if (end < trimmedSource.length) {
		snippet = `${snippet}…`;
	}

	return snippet;
}
