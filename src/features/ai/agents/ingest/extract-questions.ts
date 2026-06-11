import {
	generateJson,
	generateJsonStream,
	type GenerateJsonStreamChunk,
	type StructuredOutputCompleteEvent,
} from "@/features/ai/core/generate";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { examIngestResponseSchema } from "@/lib/validation";
import { buildSystemPrompt } from "./system-prompt";

export async function extractQuestionsFromText(
	config: ProviderConfig,
	text: string,
	_memoryContext?: string,
	options?: {
		onChunk?: (
			chunk:
				| GenerateJsonStreamChunk<ExamIngestResponse>
				| StructuredOutputCompleteEvent<ExamIngestResponse>,
		) => void;
		tools?: NonNullable<Parameters<typeof generateJson>[3]>["tools"];
		criticalTopics?: string[];
		enableWebVerification?: boolean;
	},
): Promise<ExamIngestResponse> {
	const systemPrompt = buildSystemPrompt({
		criticalTopics: options?.criticalTopics,
		enableWebVerification: options?.enableWebVerification,
	});
	const prompt = `
    Extract all exam questions from the following text.
    Return ONLY a valid JSON object with this exact structure:
    {
      "questions": [
        {
          "question": "the question text",
          "options": ["option a", "option b", "option c", "option d"],
          "answers": ["the correct answer text"],
          "scoringMode": "exact",
          "explanation": "",
          "topic": "subject/topic name"
        }
      ],
      "topics": ["list", "of", "unique", "topics"]
    }

    Text to extract from:
    ${text}
  `;

	if (options?.onChunk) {
		return await generateJsonStream<ExamIngestResponse>(
			config,
			prompt,
			examIngestResponseSchema,
			{
				system: systemPrompt,
				onChunk: options.onChunk,
				tools: options.tools,
			},
		);
	}

	return await generateJson<ExamIngestResponse>(
		config,
		prompt,
		examIngestResponseSchema,
		{ system: systemPrompt, tools: options?.tools },
	);
}
