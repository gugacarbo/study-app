import type { WebSearchProvider, WebSearchResponse } from "./types";

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
				throw new Error(`Tavily returned status ${response.status}`);
			}

			const payload = (await response.json()) as TavilySearchResponse;
			const results = (payload.results ?? [])
				.filter((item): item is Required<Pick<TavilySearchResult, "url">> &
					TavilySearchResult => Boolean(item.url))
				.map((item) => ({
					title: item.title?.trim() || "Untitled",
					url: item.url,
					snippet: item.content?.trim() || "",
				}));

			return {
				query: input.query,
				results,
			};
		} finally {
			clearTimeout(timeoutHandle);
		}
	}
}
