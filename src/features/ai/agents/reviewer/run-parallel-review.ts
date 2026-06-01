import { chat } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";
import {
	buildReviewerSystemPrompt,
	REVIEW_ARBITER_SYSTEM_PROMPT,
} from "./system-prompt";

interface ParallelReviewOptions {
	tools?: Parameters<typeof chat>[0]["tools"];
	reviewerCount?: number;
}

export interface ParallelReviewResult {
	answer: string;
	reviewerDrafts: string[];
}

function normalizeTextOutput(value: unknown): string {
	if (typeof value === "string") {
		return value.trim();
	}
	if (value == null) {
		return "";
	}
	return String(value).trim();
}

export async function runParallelReview(
	config: ProviderConfig,
	question: string,
	options?: ParallelReviewOptions,
): Promise<ParallelReviewResult> {
	const adapter = getAiAdapter(config);
	const reviewerCount = Math.max(2, options?.reviewerCount ?? 3);

	const reviewerDrafts = await Promise.all(
		Array.from({ length: reviewerCount }, async (_, index) => {
			const reviewerResult = await chat({
				adapter,
				messages: [{ role: "user", content: question }],
				systemPrompts: [buildReviewerSystemPrompt(index + 1)],
				tools: options?.tools,
				stream: false,
			});
			return normalizeTextOutput(reviewerResult);
		}),
	);

	const arbiterPrompt = `User question:
${question}

Reviewer drafts:
${reviewerDrafts
	.map((draft, index) => `Reviewer ${index + 1}:\n${draft}`)
	.join("\n\n---\n\n")}`;

	const arbiterResult = await chat({
		adapter,
		messages: [{ role: "user", content: arbiterPrompt }],
		systemPrompts: [REVIEW_ARBITER_SYSTEM_PROMPT],
		tools: options?.tools,
		stream: false,
	});

	return {
		answer: normalizeTextOutput(arbiterResult),
		reviewerDrafts,
	};
}
