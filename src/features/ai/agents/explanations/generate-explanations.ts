import { z } from "zod";
import type { ProviderConfig } from "@/lib/validation";
import { generateJson } from "@/features/ai/core/generate";
import { buildSystemPrompt } from "./system-prompt";

const explanationBatchSchema = z.object({
	questions: z.array(
		z.object({
			id: z.number().int().positive(),
			explanation: z.string().min(1),
			deepExplanation: z.string().min(1),
		}),
	),
});

type ExplanationBatchResult = z.infer<typeof explanationBatchSchema>;

export interface ExplanationBatchInput {
	id: number;
	question: string;
	options: string[];
	answer: string;
	topic?: string;
	explanation?: string;
}

export async function generateQuestionExplanationsBatch(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	memoryContext?: string,
): Promise<ExplanationBatchResult["questions"]> {
	const system = buildSystemPrompt(memoryContext);
	const prompt = `Generate explanation and deepExplanation for each question below.

Questions input:
${JSON.stringify(questions, null, 2)}`;

	const result = await generateJson<ExplanationBatchResult>(
		config,
		prompt,
		explanationBatchSchema,
		{ system },
	);

	return result.questions;
}
