import type { DBQueries } from "./base";

export function getMemoryStats(_this: DBQueries): Promise<{
	totalDocuments: number;
	totalSessions: number;
}> {
	return Promise.resolve({ totalDocuments: 0, totalSessions: 0 });
}
