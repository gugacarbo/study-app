import { generateJson } from "@/features/ai/core/generate";
import type {
	ExamIngestResponse,
	ProviderConfig,
	Question,
} from "@/lib/validation";
import { ingestQuestionSchema } from "@/lib/validation";

export interface IngestReviewEvent {
	type: "step" | "warning";
	message: string;
}

type AgentRunStatus = "pending" | "running" | "done" | "error" | "skipped";
type AgentRunEventType = "lifecycle" | "result" | "warning" | "token";

export interface IngestReviewAgentEvent {
	eventType: AgentRunEventType;
	stageId: "review";
	agentRunId: string;
	label: string;
	status?: AgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?: unknown;
	meta?: Record<string, unknown>;
}

export interface IngestReviewResult {
	extracted: ExamIngestResponse;
	reviewed: boolean;
	reviewedQuestionCount: number;
	failedQuestionCount: number;
	reasons: string[];
}

interface ReviewExtractionOptions {
	reviewTopics: string[];
	tools?: NonNullable<Parameters<typeof generateJson>[3]>["tools"];
	onEvent?: (event: IngestReviewEvent) => void;
	onAgentEvent?: (event: IngestReviewAgentEvent) => void;
	createAgentRunId?: (label: string) => string;
}

const reviewerQuestionSchema = ingestQuestionSchema;

const REVIEW_CONCURRENCY = 10;

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

function deriveTopics(
	questions: Question[],
	fallbackTopics: string[],
): string[] {
	const questionTopics = questions
		.map((question) => question.topic?.trim())
		.filter((topic): topic is string => Boolean(topic));

	return unique(
		[...questionTopics, ...fallbackTopics.map((topic) => topic.trim())].filter(
			Boolean,
		),
	);
}

function buildReviewerSystemPrompt(reviewTopics: string[]): string {
	const sections = [
		"You are a reviewer for a single extracted exam question.",
		"Your only task is to verify and correct one question object while preserving the original language from the source text.",
		'Return ONLY one valid JSON object with the exact keys "question", "options", "answer", "explanation", and "topic".',
		'Always keep "options" with at least 2 items. For open-ended questions, include the exact correct answer plus at least one short incorrect distractor.',
		'Always set "explanation" to "".',
		"Do not invent extra fields or commentary.",
	];

	if (reviewTopics.length > 0) {
		sections.push(
			`Priority topics for extra care: ${reviewTopics.join(", ")}.`,
		);
	}

	return sections.join("\n");
}

function buildReviewerUserPrompt(
	sourceText: string,
	question: Question,
	index: number,
): string {
	return `Review extracted question #${index + 1}.

Source text:
${sourceText.slice(0, 45_000)}

Current extracted question JSON:
${JSON.stringify(question)}

Task:
- Check whether the question text, options, answer, and topic are faithful to the source.
- Fix OCR issues or obvious extraction mistakes when the source supports it.
- Preserve the original language from the source text.
- Keep the structure fully compatible with the existing question schema.
- Return only the corrected JSON object.`;
}

function emitAgentEvent(
	options: ReviewExtractionOptions,
	event: IngestReviewAgentEvent,
) {
	options.onAgentEvent?.(event);
}

async function mapWithConcurrency<T, R>(
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

export async function reviewExtraction(
	config: ProviderConfig,
	sourceText: string,
	extracted: ExamIngestResponse,
	options: ReviewExtractionOptions,
): Promise<IngestReviewResult> {
	const totalQuestions = extracted.questions.length;

	if (totalQuestions === 0) {
		options.onEvent?.({
			type: "warning",
			message: "No extracted questions were available for review.",
		});
		return {
			extracted,
			reviewed: false,
			reviewedQuestionCount: 0,
			failedQuestionCount: 0,
			reasons: ["no_questions"],
		};
	}

	if (!options.tools?.length) {
		options.onEvent?.({
			type: "warning",
			message:
				"Web verification tools are unavailable. Continuing with LLM-only review (no web search/fetch).",
		});
	}

	options.onEvent?.({
		type: "step",
		message: `Reviewing ${totalQuestions} extracted question${totalQuestions === 1 ? "" : "s"} in parallel...`,
	});

	const reviewedQuestions = await mapWithConcurrency(
		extracted.questions,
		REVIEW_CONCURRENCY,
		async (question, index) => {
			const label = `Reviewer Q${index + 1}`;
			const agentRunId =
				options.createAgentRunId?.(label) ?? `review-question-${index + 1}`;
			const systemPrompt = buildReviewerSystemPrompt(options.reviewTopics);
			const userPrompt = buildReviewerUserPrompt(sourceText, question, index);

			emitAgentEvent(options, {
				eventType: "lifecycle",
				stageId: "review",
				agentRunId,
				label,
				status: "pending",
				systemPrompt,
				userPrompt,
				meta: {
					questionIndex: index,
					questionNumber: index + 1,
					topic: question.topic ?? "General",
				},
			});
			emitAgentEvent(options, {
				eventType: "lifecycle",
				stageId: "review",
				agentRunId,
				label,
				status: "running",
				meta: {
					questionIndex: index,
					questionNumber: index + 1,
				},
			});

			try {
				const reviewedQuestion = await generateJson<Question>(
					config,
					userPrompt,
					reviewerQuestionSchema,
					{
						system: systemPrompt,
						tools: options.tools,
					},
				);

				emitAgentEvent(options, {
					eventType: "result",
					stageId: "review",
					agentRunId,
					label,
					finalObject: reviewedQuestion,
					rawText: JSON.stringify(reviewedQuestion),
					meta: {
						questionIndex: index,
						questionNumber: index + 1,
					},
				});
				emitAgentEvent(options, {
					eventType: "lifecycle",
					stageId: "review",
					agentRunId,
					label,
					status: "done",
					meta: {
						questionIndex: index,
						questionNumber: index + 1,
					},
				});

				return {
					question: reviewedQuestion,
					success: true,
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "unknown error";
				console.error(
					`[${new Date().toISOString()} ERROR review-extraction] ` +
						`Review Q${index + 1}/${totalQuestions} failed: ${message}`,
					`question="${question.question.slice(0, 120)}..."`,
					`topic=${question.topic ?? "General"}`,
				);

				emitAgentEvent(options, {
					eventType: "lifecycle",
					stageId: "review",
					agentRunId,
					label,
					status: "error",
					error: message,
					meta: {
						questionIndex: index,
						questionNumber: index + 1,
					},
				});
				emitAgentEvent(options, {
					eventType: "warning",
					stageId: "review",
					agentRunId,
					label,
					warning: `Review failed for question #${index + 1}. Keeping the original extracted question.`,
					meta: {
						questionIndex: index,
						questionNumber: index + 1,
					},
				});

				return {
					question,
					success: false,
					reason: message,
				};
			}
		},
	);

	const failedQuestionCount = reviewedQuestions.filter(
		(result) => !result.success,
	).length;
	const reviewedQuestionCount = reviewedQuestions.length - failedQuestionCount;
	const questions = reviewedQuestions.map((result) => result.question);

	return {
		extracted: {
			questions,
			topics: deriveTopics(questions, extracted.topics),
		},
		reviewed: true,
		reviewedQuestionCount,
		failedQuestionCount,
		reasons: reviewedQuestions
			.flatMap((result) =>
				"reason" in result && result.reason ? [result.reason] : [],
			)
			.filter(Boolean),
	};
}
