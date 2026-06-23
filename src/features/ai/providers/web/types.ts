export type WebSearchResult = {
	title: string;
	url: string;
	snippet: string;
};

export type WebSearchResponse = {
	query: string;
	results: WebSearchResult[];
};

export interface WebSearchProvider {
	search(input: {
		query: string;
		maxResults: number;
	}): Promise<WebSearchResponse>;
}

export type WebFetchResponse = {
	url: string;
	title: string;
	content: string;
};

export interface WebContentProvider {
	fetchContent(input: {
		url: string;
		maxChars: number;
	}): Promise<WebFetchResponse>;
}
