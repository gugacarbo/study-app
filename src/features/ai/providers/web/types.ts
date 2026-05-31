import { z } from "zod";

export const webSearchResultSchema = z.object({
	title: z.string(),
	url: z.string().url(),
	snippet: z.string(),
});

export type WebSearchResult = z.infer<typeof webSearchResultSchema>;

export const webSearchResponseSchema = z.object({
	query: z.string(),
	results: z.array(webSearchResultSchema),
});

export type WebSearchResponse = z.infer<typeof webSearchResponseSchema>;

export interface WebSearchProvider {
	search(input: {
		query: string;
		maxResults: number;
	}): Promise<WebSearchResponse>;
}

export const webFetchResponseSchema = z.object({
	url: z.string().url(),
	title: z.string(),
	content: z.string(),
});

export type WebFetchResponse = z.infer<typeof webFetchResponseSchema>;

export interface WebContentProvider {
	fetchContent(input: {
		url: string;
		maxChars: number;
	}): Promise<WebFetchResponse>;
}
