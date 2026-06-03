function toBoolean(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "1";
	}
	if (typeof value === "number") return value === 1;
	return false;
}

function summarizeSearchResultSnippets(
	results: Array<{ snippet: string }>,
	maxItems: number = 3,
): string {
	const snippets = results
		.map((result) => result.snippet.trim())
		.filter(Boolean)
		.slice(0, maxItems);

	if (snippets.length === 0) {
		return "No snippets available.";
	}

	return snippets.join("\n\n");
}

export { summarizeSearchResultSnippets, toBoolean };
