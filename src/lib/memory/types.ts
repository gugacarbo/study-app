import type { R2Bucket } from "@cloudflare/workers-types";

export interface QuizSessionData {
	examName: string;
	topic: string;
	totalQuestions: number;
	correctAnswers: number;
	questions: Array<{
		question: string;
		userAnswer: string;
		correctAnswer: string;
		isCorrect: boolean;
		explanation: string;
		topic: string;
	}>;
	duration?: number;
}

export interface MemoryContext {
	profileNotes: string;
	recentSessions: string;
	topicNotes: string;
	relevantSearchResults: string;
}

export interface SearchResult {
	path: string;
	content: string;
}

export interface SearchIndexRow {
	path: string;
	r2Key: string;
	searchText: string;
}

export interface MemoryOverview {
	profileNotes: string;
	recentSessions: Array<{
		id: number;
		sessionDate: string;
		topic: string;
		examName: string;
		totalQuestions: number;
		correctAnswers: number;
		accuracy: number;
		createdAt: string;
	}>;
	topicNotes: Array<{
		topic: string;
		updatedAt: string;
	}>;
	documents: Array<{
		id: number;
		type: string;
		name: string;
		topic: string | null;
		createdAt: string;
	}>;
}

export function resolveBucket(cached?: R2Bucket): Promise<R2Bucket> {
	const dynamic =
		cached ??
		(async () => {
			const { getMemoryBucket } = await import(
				"../../server-functions/storage"
			);
			const resolved = await getMemoryBucket();
			if (!resolved) {
				throw new Error("R2 MEMORY_BUCKET binding is not available");
			}
			return resolved;
		})();
	// The cached value is directly available; for async lazy resolution return the promise.
	if (!(dynamic instanceof Promise)) return Promise.resolve(dynamic);
	return dynamic;
}
