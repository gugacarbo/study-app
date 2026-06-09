export interface TopicMemoryResolver {
	resolveMemoryContext: (topic?: string) => string | undefined;
}

interface MemoryPromptBuilder {
	buildMemoryPrompt: (topics: string[]) => Promise<string>;
}

export async function buildTopicMemoryResolver(
	memory: MemoryPromptBuilder,
	topics: string[],
): Promise<TopicMemoryResolver> {
	const uniqueTopics = [
		...new Set(topics.map((topic) => topic.trim() || "General")),
	];
	const memoryByTopic = new Map<string, string>();

	await Promise.all(
		uniqueTopics.map(async (topic) => {
			const context = await memory.buildMemoryPrompt([topic]).catch(() => "");
			memoryByTopic.set(topic, context);
		}),
	);

	return {
		resolveMemoryContext: (topic?: string) => {
			const context = memoryByTopic.get(topic?.trim() || "General");
			return context && context.length > 0 ? context : undefined;
		},
	};
}
