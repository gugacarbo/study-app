import type { WebContentProvider, WebFetchResponse } from "./types";

const DEFAULT_TAVILY_BASE_URL = "https://api.tavily.com";

type TavilyExtractResponse = {
	results?: Array<{
		url?: string;
		title?: string;
		raw_content?: string;
		content?: string;
	}>;
};

export class TavilyWebContentProvider implements WebContentProvider {
	constructor(
		private readonly options: {
			apiKey: string;
			baseUrl?: string;
			timeoutMs?: number;
		},
	) {}

	async fetchContent(input: {
		url: string;
		maxChars: number;
	}): Promise<WebFetchResponse> {
		const controller = new AbortController();
		const timeoutHandle = setTimeout(
			() => controller.abort(new Error("Tavily extract timed out")),
			this.options.timeoutMs ?? 15_000,
		);

		try {
			const response = await fetch(
				`${this.options.baseUrl ?? DEFAULT_TAVILY_BASE_URL}/extract`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.options.apiKey}`,
					},
					body: JSON.stringify({
						urls: [input.url],
						extract_depth: "basic",
						include_raw_content: true,
					}),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				throw new Error(`Tavily returned status ${response.status}`);
			}

			const payload = (await response.json()) as TavilyExtractResponse;
			const first = payload.results?.[0];
			if (!first?.url) {
				throw new Error("No extract result returned for URL");
			}

			const content = (first.raw_content || first.content || "").trim();

			return {
				url: first.url,
				title: first.title?.trim() || "Untitled",
				content: content.slice(0, input.maxChars),
			};
		} finally {
			clearTimeout(timeoutHandle);
		}
	}
}
