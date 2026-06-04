export function summarizeSearchResultSnippets(
	results: Array<{ snippet: string }>,
	maxItems = 3,
): string {
	const snippets = results
		.map((result) => result.snippet.trim())
		.filter(Boolean)
		.slice(0, maxItems);

	if (snippets.length === 0) return "No snippets available.";

	return snippets.join("\n\n");
}

export function parseCriticalTopics(value: string | null): string[] {
	if (!value) return [];

	const parsedJson = (() => {
		try {
			return JSON.parse(value) as unknown;
		} catch (parseError) {
			console.warn("Failed to parse critical topics as JSON:", parseError);
			return null;
		}
	})();

	if (Array.isArray(parsedJson)) {
		return Array.from(
			new Set(
				parsedJson
					.filter((item): item is string => typeof item === "string")
					.map((topic) => topic.trim())
					.filter(Boolean),
			),
		);
	}

	return Array.from(
		new Set(
			value
				.split(/[\n,;]+/)
				.map((part) => part.trim())
				.filter(Boolean),
		),
	);
}
