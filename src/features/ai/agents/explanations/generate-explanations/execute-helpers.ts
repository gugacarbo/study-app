import type {
	ExplanationAgentRunEvent,
	RunQuestionExplanationsOptions,
} from "./types";

export function emitAgentEvent(
	options: RunQuestionExplanationsOptions,
	event: ExplanationAgentRunEvent,
) {
	options.onAgentEvent?.(event);
}

export async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await mapper(items[currentIndex], currentIndex);
		}
	}

	const workerCount = Math.min(concurrency, items.length);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
}
