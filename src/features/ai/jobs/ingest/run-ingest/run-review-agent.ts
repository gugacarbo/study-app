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
import { listQuestionsByExam } from "@/db/queries/questions";
import { buildIngestStepMessageId, buildReasoningDeltaPart, buildReasoningPart, buildStreamTextPart, buildStreamToolCallPart, REASONING_THROTTLE_MS, serializeIngestStreamPart } from "@/features/ai/jobs/ingest/run-ingest/ingest-stream-parts";
import { MAX_AGENT_STEPS, REVIEW_AGENT_SYSTEM_PROMPT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import {
	createReviewAgentTools,
	type ReviewDraftQuestion,
} from "@/features/ai/jobs/ingest/run-ingest/review-agent-tools";
import type { RunIngestContext } from "@/features/ai/jobs/ingest/run-ingest/types";

export const REVIEW_WARNING_FALLBACK = "review_fallback" as const;

type RunReviewAgentOptions = {
	ctx: RunIngestContext;
	model: LanguageModel;
	examId: string;
	drafts: ReviewDraftQuestion[];
	isCancelRequested: () => Promise<boolean>;
	streamText?: typeof streamTextFn;
};

type RunReviewAgentResult =
	| {
			ok: true;
			questions: ReviewDraftQuestion[];
			reviewedCount: number;
	  }
	| {
			ok: false;
			reason: typeof REVIEW_WARNING_FALLBACK;
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
			(this.lastFlushAt === 0 || now - this.lastFlushAt >= REASONING_THROTTLE_MS)
		) {
			await this.flushPendingDelta(now);
		}
	}

	async handleEnd(messageId: string): Promise<void> {
		if (this.messageId !== messageId) return;
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
		if (this.pendingDelta.length === 0 || !this.messageId) return;
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
		if (this.messageId !== messageId) return;
		await this.flush();
	}

	private async flush(): Promise<void> {
		if (this.buffer.length === 0 || !this.messageId) return;
		await this.appendPart(
			serializeIngestStreamPart(
				buildStreamTextPart(this.messageId, this.buffer),
			),
		);
		this.buffer = "";
	}
}

function buildReviewPrompt(input: {
	drafts: ReviewDraftQuestion[];
	existingTopics: string[];
}): string {
	return JSON.stringify({
		existingTopics: input.existingTopics,
		questions: input.drafts.map((draft) => ({
			draftQuestionId: draft.draftQuestionId,
			sourceIndex: draft.sourceIndex,
			question: draft.question,
			options: draft.options,
			answers: draft.answers,
			topic: draft.topic,
		})),
	});
}

function isToolCallingUnsupportedError(error: unknown): boolean {
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

export async function runReviewAgent(
	options: RunReviewAgentOptions,
): Promise<RunReviewAgentResult> {
	const invokeStreamText = options.streamText ?? streamText;
	const abortController = new AbortController();
	const drafts = options.drafts.map((draft) => ({ ...draft }));
	let stepNumber = 0;
	let currentMessageId = buildIngestStepMessageId(1).replace("ingest", "review");
	let reviewFinished = false;

	let existingTopics: string[] = [];
	try {
		const existingRows = await listQuestionsByExam(options.ctx.db, options.examId);
		existingTopics = Array.from(
			new Set(
				existingRows
					.map((row) => row.topic?.trim())
					.filter((topic): topic is string => Boolean(topic)),
			),
		).slice(0, 50);
	} catch {
		existingTopics = [];
	}

	const appender = new JobEventAppender(
		options.ctx.jobId,
		options.ctx.deps.appendJobEvent,
	);
	const appendPart = async (payload: string) => {
		await appender.append(payload);
	};

	const tools = createReviewAgentTools({
		append: appendPart,
		getCurrentMessageId: () => currentMessageId,
		drafts,
		onFinishReview: () => {
			reviewFinished = true;
		},
		searchSimilarTopics: (input) =>
			searchSimilarQuestionTopics(options.ctx.db, input).then((topics) =>
				topics.map((topic) => ({
					topicId: topic.id,
					name: topic.name,
					normalizedName: topic.normalizedName,
					similarityLabel: topic.similarityLabel,
				})),
			),
		createTopic: async (name) => {
			const result = await createQuestionTopic(options.ctx.db, name);
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

	try {
		const result = invokeStreamText({
			model: options.model,
			system: REVIEW_AGENT_SYSTEM_PROMPT,
			prompt: buildReviewPrompt({ drafts, existingTopics }),
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
				case "start-step":
					stepNumber += 1;
					currentMessageId = buildIngestStepMessageId(stepNumber).replace(
						"ingest",
						"review",
					);
					break;
				case "reasoning-delta":
					await reasoningWriter.handleDelta(currentMessageId, part.text);
					break;
				case "reasoning-end":
					await reasoningWriter.handleEnd(currentMessageId);
					break;
				case "text-delta":
					await textWriter.handleDelta(currentMessageId, part.text);
					break;
				case "text-end":
					await textWriter.handleEnd(currentMessageId);
					break;
				case "tool-call":
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
				case "error":
					throw part.error;
				default:
					break;
			}

			if (reviewFinished) {
				abortController.abort();
			}
		}

		if (!reviewFinished) {
			return { ok: false, reason: REVIEW_WARNING_FALLBACK };
		}

		return {
			ok: true,
			questions: drafts,
			reviewedCount: drafts.length,
		};
	} catch (error) {
		if (isToolCallingUnsupportedError(error)) {
			return { ok: false, reason: REVIEW_WARNING_FALLBACK };
		}
		return { ok: false, reason: REVIEW_WARNING_FALLBACK };
	}
}
