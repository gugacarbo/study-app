import { z } from "zod";

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
