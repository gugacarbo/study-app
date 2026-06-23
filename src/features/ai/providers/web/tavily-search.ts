import type { WebSearchProvider, WebSearchResponse } from "@/features/ai/providers/web/types";

const DEFAULT_TAVILY_BASE_URL = "https://api.tavily.com";

type TavilySearchResult = {
	title?: string;
	url?: string;
	content?: string;
};

type TavilySearchResponse = {
	results?: TavilySearchResult[];
};

export class TavilyWebSearchProvider implements WebSearchProvider {
	constructor(
		private readonly options: {
			apiKey: string;
			baseUrl?: string;
			timeoutMs?: number;
		},
	) {}

	async search(input: {
		query: string;
		maxResults: number;
	}): Promise<WebSearchResponse> {
		const controller = new AbortController();
		const timeoutHandle = setTimeout(
			() => controller.abort(new Error("Tavily search timed out")),
			this.options.timeoutMs ?? 12_000,
		);

		try {
			const response = await fetch(
				`${this.options.baseUrl ?? DEFAULT_TAVILY_BASE_URL}/search`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.options.apiKey}`,
					},
					body: JSON.stringify({
						query: input.query,
						max_results: input.maxResults,
						search_depth: "basic",
					}),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				const body = await response.text().catch(() => "");
				throw new Error(`Tavily search failed (${response.status}): ${body}`);
			}

			const payload = (await response.json()) as TavilySearchResponse;
			return {
				query: input.query,
				results: (payload.results ?? [])
					.filter((item): item is TavilySearchResult & { url: string } =>
						Boolean(item.url),
					)
					.map((item) => ({
						title: item.title?.trim() || "Untitled",
						url: item.url,
						snippet: item.content?.trim() || "",
					})),
			};
		} finally {
			clearTimeout(timeoutHandle);
		}
	}
}
