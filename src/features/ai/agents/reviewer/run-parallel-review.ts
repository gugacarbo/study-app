import { generateJson } from "@/features/ai/core/generate";
import type { ProviderConfig } from "@/lib/validation";
import {
	buildReviewerSystemPrompt,
	REVIEW_ARBITER_SYSTEM_PROMPT,
	reviewerDraftSchema,
	arbiterResultSchema,
	type ReviewerDraft,
} from "./system-prompt";

interface ParallelReviewOptions {
	tools?: Parameters<typeof generateJson>[3]["tools"];
	reviewerCount?: number;
	onWarning?: (message: string) => void;
}

export interface ParallelReviewResult {
	answer: string;
	confidence: string;
	conflictNotes?: string;
	sources: string[];
	reviewerDrafts: ReviewerDraft[];
	failedReviewerCount: number;
}

export async function runParallelReview(
	config: ProviderConfig,
	question: string,
	options?: ParallelReviewOptions,
): Promise<ParallelReviewResult> {
	const reviewerCount = Math.max(2, Math.min(options?.reviewerCount ?? 3, 5));

	const reviewPromises = Array.from(
		{ length: reviewerCount },
		async (_, index) => {
			try {
				const systemPrompt = buildReviewerSystemPrompt(index + 1);
				const reviewerResult = await generateJson(
					config,
					question,
					reviewerDraftSchema,
					{
						system: systemPrompt,
						tools: options?.tools,
					},
				);
				return { ok: true as const, draft: reviewerResult.finalObject };
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown reviewer error";
				console.warn(`Reviewer #${index + 1} failed:`, error);
				options?.onWarning?.(`Reviewer #${index + 1} failed: ${message}`);
				return { ok: false as const, error: message };
			}
		},
	);

	const reviewResults = await Promise.all(reviewPromises);

	const reviewerDrafts: ReviewerDraft[] = [];
	let failedReviewerCount = 0;

	for (const result of reviewResults) {
		if (result.ok && result.draft) {
			reviewerDrafts.push(result.draft);
		} else {
			failedReviewerCount++;
		}
	}

	if (reviewerDrafts.length === 0) {
		throw new Error(
			`All ${reviewerCount} reviewers failed. Unable to produce a review.`,
		);
	}

	if (failedReviewerCount > 0) {
		options?.onWarning?.(
			`${failedReviewerCount} of ${reviewerCount} reviewers failed — proceeding with ${reviewerDrafts.length} draft(s).`,
		);
	}

	const arbiterPrompt = `User question:
${question}

Reviewer drafts (JSON):
${reviewerDrafts
	.map(
		(draft, i) =>
			`Reviewer ${i + 1}:
${JSON.stringify(draft, null, 2)}`,
	)
	.join("\n\n---\n\n")}

${failedReviewerCount > 0 ? `Note: ${failedReviewerCount} reviewer(s) failed — rely on the available drafts.` : ""}`;

	const arbiterResult = await generateJson(
		config,
		arbiterPrompt,
		arbiterResultSchema,
		{ system: REVIEW_ARBITER_SYSTEM_PROMPT, tools: options?.tools },
	);

	const finalAnswer = arbiterResult.finalObject;

	return {
		answer: finalAnswer.answer,
		confidence: finalAnswer.confidence,
		conflictNotes: finalAnswer.conflictNotes,
		sources: finalAnswer.sources,
		reviewerDrafts,
		failedReviewerCount,
	};
}
