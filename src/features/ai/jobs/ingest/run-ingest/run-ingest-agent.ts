import {
	stepCountIs,
	streamText,
	UnsupportedFunctionalityError,
	type LanguageModel,
	type streamText as streamTextFn,
} from "ai";
import {
	createQuestionTopic,
	searchSimilarQuestionTopics,
} from "@/db/queries/question-topics";
import type { AppDatabase } from "@/db/client";
import type { ResolvedExtractedQuestion } from "@/features/ai/jobs/ingest/extracted-question";
import type { TokenUsage } from "@/lib/job-kinds";
import { createIngestAgentTools } from "./ingest-agent-tools";
import {
	buildIngestStepMessageId,
	buildReasoningDeltaPart,
	buildReasoningPart,
	buildStreamTextPart,
	buildStreamToolCallPart,
	REASONING_THROTTLE_MS,
	serializeIngestStreamPart,
} from "./ingest-stream-parts";
import { INGEST_AGENT_SYSTEM_PROMPT, MAX_AGENT_STEPS } from "./constants";

export type RunIngestAgentResult = {
	questions: ResolvedExtractedQuestion[];
	extractionMode: "agent";
	usage?: TokenUsage;
};

export type RunIngestAgentOptions = {
	db: AppDatabase;
	model: LanguageModel;
	fileText: string;
	jobId: string;
	appendJobEvent: (jobId: string, payload: string) => Promise<void>;
	isCancelRequested: () => Promise<boolean>;
	streamText?: typeof streamTextFn;
};

class JobEventAppender {
	private queue: {
		payload: string;
		resolve: () => void;
		reject: (err: unknown) => void;
	}[] = [];
	private running = false;
	private readonly maxRetries = 3;
	private readonly baseDelayMs = 10;

	constructor(
		private readonly jobId: string,
		private readonly appendJobEvent: (
			jobId: string,
			payload: string,
		) => Promise<void>,
	) {}

	append(payload: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.queue.push({ payload, resolve, reject });
			void this.process();
		});
	}

	private async process(): Promise<void> {
		if (this.running) return;
		this.running = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift();
			if (!item) continue;

			try {
				await this.appendWithRetry(item.payload);
				item.resolve();
			} catch (err) {
				item.reject(err);
			}
		}

		this.running = false;
	}

	private async appendWithRetry(payload: string): Promise<void> {
		for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
			try {
				await this.appendJobEvent(this.jobId, payload);
				return;
			} catch (err) {
				const isUniqueViolation =
					err instanceof Error &&
					(/unique/i.test(err.message) || /constraint/i.test(err.message));
				if (!isUniqueViolation || attempt === this.maxRetries) {
					throw err;
				}
				await new Promise((resolve) =>
					setTimeout(resolve, this.baseDelayMs * 2 ** attempt),
				);
			}
		}
	}
}

class ReasoningStreamWriter {
	private accumulated = "";
	private pendingDelta = "";
	private lastFlushAt = 0;
	private messageId = "";

	constructor(
		private readonly appendPart: (payload: string) => Promise<void>,
	) {}

	async handleDelta(messageId: string, delta: string): Promise<void> {
		if (this.messageId !== messageId) {
			await this.flushPendingDelta();
			this.messageId = messageId;
			this.accumulated = "";
			this.pendingDelta = "";
			this.lastFlushAt = 0;
		}

		this.accumulated += delta;
		this.pendingDelta += delta;

		const now = Date.now();
		if (
			this.pendingDelta.length > 0 &&
			(this.lastFlushAt === 0 ||
				now - this.lastFlushAt >= REASONING_THROTTLE_MS)
		) {
			await this.flushPendingDelta(now);
		}
	}

	async handleEnd(messageId: string): Promise<void> {
		if (this.messageId !== messageId) {
			return;
		}

		await this.flushPendingDelta();
		if (this.accumulated.length > 0) {
			await this.appendPart(
				serializeIngestStreamPart(
					buildReasoningPart(messageId, this.accumulated),
				),
			);
		}
	}

	private async flushPendingDelta(now = Date.now()): Promise<void> {
		if (this.pendingDelta.length === 0 || !this.messageId) {
			return;
		}

		await this.appendPart(
			serializeIngestStreamPart(
				buildReasoningDeltaPart(this.messageId, this.pendingDelta),
			),
		);
		this.pendingDelta = "";
		this.lastFlushAt = now;
	}
}

class AssistantTextWriter {
	private buffer = "";
	private messageId = "";

	constructor(
		private readonly appendPart: (payload: string) => Promise<void>,
	) {}

	async handleDelta(messageId: string, delta: string): Promise<void> {
		if (this.messageId !== messageId) {
			await this.flush();
			this.messageId = messageId;
			this.buffer = "";
		}
		this.buffer += delta;
	}

	async handleEnd(messageId: string): Promise<void> {
		if (this.messageId !== messageId) {
			return;
		}
		await this.flush();
	}

	private async flush(): Promise<void> {
		if (this.buffer.length === 0 || !this.messageId) {
			return;
		}
		await this.appendPart(
			serializeIngestStreamPart(
				buildStreamTextPart(this.messageId, this.buffer),
			),
		);
		this.buffer = "";
	}
}

export function isToolCallingUnsupportedError(error: unknown): boolean {
	if (UnsupportedFunctionalityError.isInstance(error)) {
		return true;
	}
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("tool") &&
			(message.includes("not support") ||
				message.includes("unsupported") ||
				message.includes("does not support"))
		);
	}
	return false;
}

export async function runIngestAgent(
	options: RunIngestAgentOptions,
): Promise<RunIngestAgentResult> {
	const invokeStreamText = options.streamText ?? streamText;
	const abortController = new AbortController();
	const questions: ResolvedExtractedQuestion[] = [];
	let stepNumber = 0;
	let currentMessageId = buildIngestStepMessageId(1);
	let extractionFinished = false;

	const appender = new JobEventAppender(
		options.jobId,
		options.appendJobEvent,
	);
	const appendPart = async (payload: string) => {
		await appender.append(payload);
	};

	const tools = createIngestAgentTools({
		append: appendPart,
		getCurrentMessageId: () => currentMessageId,
		questions,
		onFinishExtraction: () => {
			extractionFinished = true;
		},
		searchSimilarTopics: (input) =>
			searchSimilarQuestionTopics(options.db, input).then((topics) =>
				topics.map((topic) => ({
					topicId: topic.id,
					name: topic.name,
					normalizedName: topic.normalizedName,
					similarityLabel: topic.similarityLabel,
				})),
			),
		createTopic: async (name) => {
			const result = await createQuestionTopic(options.db, name);
			return {
				topicId: result.topic.id,
				name: result.topic.name,
				normalizedName: result.topic.normalizedName,
				created: result.created,
			};
		},
	});

	const reasoningWriter = new ReasoningStreamWriter(appendPart);
	const textWriter = new AssistantTextWriter(appendPart);

	const result = invokeStreamText({
		model: options.model,
		system: INGEST_AGENT_SYSTEM_PROMPT,
		prompt: options.fileText,
		tools,
		stopWhen: [stepCountIs(MAX_AGENT_STEPS)],
		abortSignal: abortController.signal,
	});

	for await (const part of result.fullStream) {
		if (await options.isCancelRequested()) {
			abortController.abort();
			break;
		}

		switch (part.type) {
			case "start-step": {
				stepNumber += 1;
				currentMessageId = buildIngestStepMessageId(stepNumber);
				break;
			}
			case "reasoning-delta": {
				await reasoningWriter.handleDelta(currentMessageId, part.text);
				break;
			}
			case "reasoning-end": {
				await reasoningWriter.handleEnd(currentMessageId);
				break;
			}
			case "text-delta": {
				await textWriter.handleDelta(currentMessageId, part.text);
				break;
			}
			case "text-end": {
				await textWriter.handleEnd(currentMessageId);
				break;
			}
			case "tool-call": {
				await appendPart(
					serializeIngestStreamPart(
						buildStreamToolCallPart({
							messageId: currentMessageId,
							toolCallId: part.toolCallId,
							toolName: part.toolName,
							argsText: JSON.stringify(part.input),
						}),
					),
				);
				break;
			}
			case "error": {
				throw part.error;
			}
			default:
				break;
		}

		if (extractionFinished) {
			abortController.abort();
		}
	}

	let usage: TokenUsage | undefined;
	try {
		const raw = await result.usage;
		usage = {
			inputTokens: raw.inputTokens ?? 0,
			outputTokens: raw.outputTokens ?? 0,
			totalTokens: raw.totalTokens ?? 0,
		};
	} catch {
		// usage may not be available (e.g. mock/custom streamText)
	}

	return {
		questions,
		extractionMode: "agent",
		usage,
	};
}
