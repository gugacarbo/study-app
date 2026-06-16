const WORD_PATTERN = /\p{L}+/gu;
const URL_IN_TEXT = /https?:\/\/\S+/gi;

function isSkippableToken(token: string): boolean {
	if (token.length <= 2) return true;
	if (/^\d+$/.test(token)) return true;
	return false;
}

export function tokenizeText(text: string): string[] {
	const tokens: string[] = [];
	const withoutUrls = text.replace(URL_IN_TEXT, " ");
	const matches = withoutUrls.matchAll(WORD_PATTERN);
	for (const match of matches) {
		const token = match[0];
		if (!isSkippableToken(token)) {
			tokens.push(token);
		}
	}
	return tokens;
}
