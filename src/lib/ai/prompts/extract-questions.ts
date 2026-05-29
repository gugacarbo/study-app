import type { StreamChunk, StructuredOutputCompleteEvent } from "@tanstack/ai";
import type { ExamIngestResponse, ProviderConfig } from "../../validation";
import { examIngestResponseSchema } from "../../validation";
import { generateJson, generateJsonStream } from "../ai";

const BASE_SYSTEM_PROMPT = `You are an exam-question extraction agent.
Your only task is to extract structured exam questions from raw text and return valid JSON.

Output contract:
- Return ONLY a JSON object (no markdown, no prose, no code fences).
- Use exactly this top-level shape:
  {
    "questions": Question[],
    "topics": string[]
  }
- Each Question object must use exactly these keys:
  - "question": string (non-empty)
  - "options": string[] (at least 2 items)
  - "answer": string (non-empty)
  - "explanation": string (always use "")
  - "topic": string (use "General" if unclear)

Extraction rules:
- Extract all questions present in the input text.
- Preserve the original language of the source text.
- Keep wording faithful to the source whenever possible.
- If options are present, include them; if not explicit, infer only when clearly implied.
- During ingestion, never generate explanations. Always set "explanation" to "".
- Do not invent extra sections or keys.

Topics rules:
- "topics" must contain unique topic names derived from extracted questions.
- Keep topic labels concise and consistent.
- Prefer order of first appearance.

Fallback behavior:
- If no valid questions are found, return:
  {"questions":[],"topics":[]}.`;

function buildSystemPrompt(memoryContext?: string) {
	if (!memoryContext) {
		return BASE_SYSTEM_PROMPT;
	}

	return `${BASE_SYSTEM_PROMPT}

Use the following student learning-history context to improve topic naming consistency.
Do not include this context text in the output.

${memoryContext}`;
}

export async function extractQuestionsFromText(
	config: ProviderConfig,
	text: string,
	memoryContext?: string,
	options?: {
		onChunk?: (
			chunk: StreamChunk | StructuredOutputCompleteEvent<ExamIngestResponse>,
		) => void;
	},
): Promise<ExamIngestResponse> {
	const systemPrompt = buildSystemPrompt(memoryContext);
	const prompt = `
    Extract all exam questions from the following text.
    Return ONLY a valid JSON object with this exact structure:
    {
      "questions": [
        {
          "question": "the question text",
          "options": ["option a", "option b", "option c", "option d"],
          "answer": "the correct answer text",
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
			{ system: systemPrompt, onChunk: options.onChunk },
		);
	}

	return await generateJson<ExamIngestResponse>(
		config,
		prompt,
		examIngestResponseSchema,
		{ system: systemPrompt },
	);
}
