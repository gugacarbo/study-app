import type { ProviderConfig } from "@/lib/validation";

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let idx = 0; idx < items.length; idx += chunkSize) {
		chunks.push(items.slice(idx, idx + chunkSize));
	}
	return chunks;
}

export type { ProviderConfig };
export { chunkArray };
