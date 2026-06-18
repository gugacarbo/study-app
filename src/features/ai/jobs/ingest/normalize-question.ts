export function normalizeQuestionText(text: string): string {
	return text.trim().replace(/\s+/g, " ").toLowerCase();
}
