import { z } from "zod";
import { generateJson } from "@/features/ai/core/generate";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { examIngestResponseSchema } from "@/lib/validation";

const uncertaintyAssessmentSchema = z.object({
	hasUncertainty: z.boolean(),
	reasons: z.array(z.string()).default([]),
});

export interface IngestReviewEvent {
	type: "step" | "warning";
	message: string;
}

export interface IngestReviewResult {
	extracted: ExamIngestResponse;
	reviewed: boolean;
	uncertaintyDetected: boolean;
	criticalTopicsMatched: string[];
	reasons: string[];
}

interface ReviewExtractionOptions {
	criticalTopics: string[];
	tools?: NonNullable<Parameters<typeof generateJson>[3]>["tools"];
	reviewerCount?: number;
	onEvent?: (event: IngestReviewEvent) => void;
}

function normalizeTopic(value: string): string {
	return value.trim().toLowerCase();
}

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

function topicMatchesCriticalTopic(topic: string, criticalTopic: string): boolean {
	const normalizedTopic = normalizeTopic(topic);
	const normalizedCritical = normalizeTopic(criticalTopic);
	return (
		normalizedTopic === normalizedCritical ||
		normalizedTopic.includes(normalizedCritical) ||
		normalizedCritical.includes(normalizedTopic)
	);
}

function getMatchedCriticalTopics(
	extracted: ExamIngestResponse,
	criticalTopics: string[],
): string[] {
	const extractedTopics = unique([
		...extracted.topics,
		...extracted.questions.map((question) => question.topic),
	]).filter(Boolean);

	const matches = criticalTopics.filter((criticalTopic) =>
		extractedTopics.some((topic) =>
			topicMatchesCriticalTopic(topic, criticalTopic),
		),
	);

	return unique(matches.map((topic) => topic.trim()).filter(Boolean));
}

async function assessUncertainty(
	config: ProviderConfig,
	sourceText: string,
	extracted: ExamIngestResponse,
	criticalTopicsMatched: string[],
	options?: {
		tools?: NonNullable<Parameters<typeof generateJson>[3]>["tools"];
	},
) {
	const prompt = `You are evaluating extraction quality for critical study topics.

Critical topics:
${criticalTopicsMatched.map((topic) => `- ${topic}`).join("\n")}

Source text:
${sourceText.slice(0, 45_000)}

Extracted JSON:
${JSON.stringify(extracted)}

Task:
- Return hasUncertainty=true if there are likely factual mismatches, ambiguous answers, OCR confusion, or missing context for critical topics.
- Return hasUncertainty=false only if extracted critical-topic items are clearly reliable.
- Keep reasons short and concrete.`;

	return await generateJson<z.infer<typeof uncertaintyAssessmentSchema>>(
		config,
		prompt,
		uncertaintyAssessmentSchema,
		{
			tools: options?.tools,
		},
	);
}

export async function reviewExtractionForCriticalTopics(
	config: ProviderConfig,
	sourceText: string,
	extracted: ExamIngestResponse,
	options: ReviewExtractionOptions,
): Promise<IngestReviewResult> {
	const criticalTopicsMatched = getMatchedCriticalTopics(
		extracted,
		options.criticalTopics,
	);

	if (criticalTopicsMatched.length === 0) {
		return {
			extracted,
			reviewed: false,
			uncertaintyDetected: false,
			criticalTopicsMatched: [],
			reasons: [],
		};
	}

	if (!options.tools?.length) {
		options.onEvent?.({
			type: "warning",
			message:
				"Web verification tools are unavailable. Continuing without critical-topic verification.",
		});
		return {
			extracted,
			reviewed: false,
			uncertaintyDetected: false,
			criticalTopicsMatched,
			reasons: ["web_tools_unavailable"],
		};
	}

	options.onEvent?.({
		type: "step",
		message: `Checking uncertainty for critical topics (${criticalTopicsMatched.join(", ")})...`,
	});

	const uncertainty = await assessUncertainty(
		config,
		sourceText,
		extracted,
		criticalTopicsMatched,
		{ tools: options.tools },
	).catch((error) => {
		options.onEvent?.({
			type: "warning",
			message: `Failed to assess uncertainty for critical topics: ${error instanceof Error ? error.message : "unknown error"}`,
		});
		return { hasUncertainty: true, reasons: ["uncertainty_assessment_failed"] };
	});

	if (!uncertainty.hasUncertainty) {
		return {
			extracted,
			reviewed: false,
			uncertaintyDetected: false,
			criticalTopicsMatched,
			reasons: uncertainty.reasons,
		};
	}

	options.onEvent?.({
		type: "step",
		message: "Uncertainty detected. Running parallel critical-topic review...",
	});

	const reviewerCount = Math.max(2, options.reviewerCount ?? 3);

	const reviewerPrompt = (reviewerId: number) => `You are Reviewer #${reviewerId} for exam ingestion quality.

Critical topics:
${criticalTopicsMatched.map((topic) => `- ${topic}`).join("\n")}

Source text:
${sourceText.slice(0, 45_000)}

Current extraction JSON:
${JSON.stringify(extracted)}

Rules:
- Validate only factual correctness and answer accuracy.
- Focus on critical topics first.
- Use web_search and web_fetch when uncertain.
- Preserve original language from source text.
- Keep structure exactly compatible with the schema.
- Return ONLY valid JSON.`;

	const reviewerDrafts = await Promise.all(
		Array.from({ length: reviewerCount }, (_, index) =>
			generateJson<ExamIngestResponse>(
				config,
				reviewerPrompt(index + 1),
				examIngestResponseSchema,
				{
					tools: options.tools,
				},
			),
		),
	).catch((error) => {
		options.onEvent?.({
			type: "warning",
			message: `Parallel reviewer execution failed. Using original extraction: ${error instanceof Error ? error.message : "unknown error"}`,
		});
		return null;
	});

	if (!reviewerDrafts?.length) {
		return {
			extracted,
			reviewed: false,
			uncertaintyDetected: true,
			criticalTopicsMatched,
			reasons: [...uncertainty.reasons, "parallel_review_failed"],
		};
	}

	const arbiterPrompt = `You are the final arbiter for exam ingestion.

Critical topics:
${criticalTopicsMatched.map((topic) => `- ${topic}`).join("\n")}

Original extraction:
${JSON.stringify(extracted)}

Reviewer drafts:
${reviewerDrafts
	.map((draft, index) => `Reviewer ${index + 1}:\n${JSON.stringify(draft)}`)
	.join("\n\n---\n\n")}

Task:
- Resolve disagreements and choose the most accurate final extraction.
- Prefer outputs consistent with source text and externally verifiable facts.
- Return ONLY valid JSON matching the exact schema.`;

	const reviewed = await generateJson<ExamIngestResponse>(
		config,
		arbiterPrompt,
		examIngestResponseSchema,
		{
			tools: options.tools,
		},
	).catch((error) => {
		options.onEvent?.({
			type: "warning",
			message: `Arbiter failed. Using first reviewer draft: ${error instanceof Error ? error.message : "unknown error"}`,
		});
		return reviewerDrafts[0];
	});

	return {
		extracted: reviewed,
		reviewed: true,
		uncertaintyDetected: true,
		criticalTopicsMatched,
		reasons: uncertainty.reasons,
	};
}
