import type { ProviderConfig } from "@/lib/validation";
import { mapWithConcurrency } from "./execute-helpers";
import { explainSingleQuestion } from "./explain-single-question";
import type {
	ExplanationAgentRunEvent,
	ExplanationAgentRunSummary,
	ExplanationBatchInput,
	ExplanationQuestionResult,
	RunQuestionExplanationsOptions,
} from "./types";

export const EXPLANATION_CONCURRENCY = 10;
export const MAX_EXPLANATION_ATTEMPTS = 3;

type QuestionExplanationResult = Awaited<
	ReturnType<typeof explainSingleQuestion>
>;

export interface QuestionExplanationsResult {
	questions: ExplanationQuestionResult[];
	agentRuns: ExplanationAgentRunSummary[];
	generatedQuestionCount: number;
	failedQuestionCount: number;
	reasons: string[];
}

export async function runQuestionExplanations(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	options: RunQuestionExplanationsOptions = {},
): Promise<QuestionExplanationsResult> {
	const totalQuestions = questions.length;
	const concurrency = options.concurrency ?? EXPLANATION_CONCURRENCY;
	const agentRuns: ExplanationAgentRunSummary[] = [];

	const wrappedOptions: RunQuestionExplanationsOptions = {
		...options,
		onAgentEvent: (event) => {
			trackAgentRun(agentRuns, event);
			options.onAgentEvent?.(event);
		},
	};

	if (totalQuestions === 0) {
		return {
			questions: [],
			agentRuns,
			generatedQuestionCount: 0,
			failedQuestionCount: 0,
			reasons: [],
		};
	}

	options.onProgress?.({
		message: `Generating explanations for ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} in parallel...`,
	});

	const results = await explainAllQuestionsWithRetries(
		config,
		questions,
		concurrency,
		wrappedOptions,
	);

	const generatedQuestions = results.flatMap((result) =>
		result.success ? [result.result] : [],
	);
	const failedQuestionCount = results.filter(
		(result) => !result.success,
	).length;

	return {
		questions: generatedQuestions,
		agentRuns,
		generatedQuestionCount: generatedQuestions.length,
		failedQuestionCount,
		reasons: results.flatMap((result) =>
			!result.success && result.reason ? [result.reason] : [],
		),
	};
}

async function explainAllQuestionsWithRetries(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	concurrency: number,
	options: RunQuestionExplanationsOptions,
): Promise<QuestionExplanationResult[]> {
	const totalQuestions = questions.length;

	const results = await mapWithConcurrency(
		questions,
		concurrency,
		(question, index) =>
			explainSingleQuestion(config, question, index, totalQuestions, options),
	);

	if (results.every((result) => !result.success)) {
		throw new Error(
			`All ${totalQuestions} explanation agent${totalQuestions === 1 ? "" : "s"} failed on the first cycle. Aborting explanation generation.`,
		);
	}

	for (let attempt = 2; attempt <= MAX_EXPLANATION_ATTEMPTS; attempt++) {
		const failedIndices = results
			.map((result, index) => (!result.success ? index : -1))
			.filter((index) => index >= 0);

		if (failedIndices.length === 0) {
			break;
		}

		options.onProgress?.({
			message: `Retrying ${failedIndices.length} failed explanation${failedIndices.length === 1 ? "" : "s"} (attempt ${attempt}/${MAX_EXPLANATION_ATTEMPTS})...`,
		});

		const retryOptions = explanationOptionsForAttempt(options, attempt);
		const retryResults = await mapWithConcurrency(
			failedIndices,
			concurrency,
			(index) =>
				explainSingleQuestion(
					config,
					questions[index],
					index,
					totalQuestions,
					retryOptions,
				),
		);

		for (let i = 0; i < failedIndices.length; i++) {
			results[failedIndices[i]] = retryResults[i];
		}
	}

	return results;
}

function explanationOptionsForAttempt(
	options: RunQuestionExplanationsOptions,
	attempt: number,
): RunQuestionExplanationsOptions {
	if (attempt <= 1) {
		return options;
	}

	const retryNumber = attempt - 1;
	return {
		...options,
		createAgentRunId: (label) =>
			options.createAgentRunId?.(`${label} (retry ${retryNumber})`) ??
			`${label}-retry-${retryNumber}`,
	};
}

function trackAgentRun(
	agentRuns: ExplanationAgentRunSummary[],
	event: ExplanationAgentRunEvent,
) {
	const existingIndex = agentRuns.findIndex(
		(run) => run.agentRunId === event.agentRunId,
	);
	const current =
		existingIndex >= 0
			? agentRuns[existingIndex]
			: {
					agentRunId: event.agentRunId,
					label: event.label,
					status: "pending" as const,
					systemPrompt: "",
					userPrompt: "",
					meta: event.meta,
				};

	const next: ExplanationAgentRunSummary = {
		...current,
		label: event.label,
		status:
			event.eventType === "lifecycle" && event.status
				? event.status
				: current.status,
		systemPrompt: event.systemPrompt ?? current.systemPrompt,
		userPrompt: event.userPrompt ?? current.userPrompt,
		rawText: event.rawText ?? current.rawText,
		finalObject:
			event.eventType === "result" && event.finalObject
				? { questions: [event.finalObject] }
				: current.finalObject,
		error: event.error ?? current.error,
		meta: event.meta ?? current.meta,
	};

	if (existingIndex >= 0) {
		agentRuns[existingIndex] = next;
		return;
	}

	agentRuns.push(next);
}
