import { generateObject, zodSchema } from "ai";
import { getAiModel } from "@/lib/ai-config";
import { JOB_ERROR_CODE, type JobErrorBody } from "@/lib/job-errors";
import type { GenerateExamJobMetadata, TokenUsage } from "@/lib/job-kinds";
import {
	createLlmLogCallId,
	logLlmCallComplete,
	logLlmCallStart,
} from "@/lib/llm-logging";
import type { GenerateExamGenerationContext } from "./types";

export type GenerateQuestionsResult =
	| { ok: true; questions: unknown[]; usage?: TokenUsage }
	| { ok: false; terminal: JobErrorBody };

export type GenerateObjectLike = (
	options: object,
) => Promise<{ object: unknown; usage?: unknown }>;

export type GetAiModelLike = (input: {
	db: Parameters<typeof getAiModel>[0]["db"];
	userId: string;
	modelId?: string;
}) => Promise<Awaited<ReturnType<typeof getAiModel>>>;

export type GenerateQuestionsDeps = {
	getAiModel: GetAiModelLike;
	generateObject: GenerateObjectLike;
	logLlmCallStart?: typeof logLlmCallStart;
	logLlmCallComplete?: typeof logLlmCallComplete;
};

const MAX_LLM_RETRIES = 2;
const RETRY_BACKOFF_MS = [500, 1500] as const;

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientLlmError(error: unknown): boolean {
	if (error && typeof error === "object" && "status" in error) {
		const status = Number((error as { status?: number }).status);
		if (status === 429 || status >= 500) return true;
	}
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("timeout") ||
			message.includes("rate limit") ||
			message.includes("429") ||
			message.includes("503") ||
			message.includes("502")
		);
	}
	return false;
}

function shortErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message.slice(0, 200);
	}
	return "llm_error";
}

export function buildGenerateQuestionsDeps(
	modelId: string,
): GenerateQuestionsDeps {
	return {
		getAiModel: async (input) => getAiModel({ ...input, modelId }),
		generateObject: generateObject as GenerateObjectLike,
	};
}

const GENERATE_SYSTEM_PROMPT = `Você é um gerador de questões objetivas para provas universitárias. Receberá um conteúdo-base e documentos de contexto parseados, e deve gerar questões de múltipla escolha no formato JSON abaixo.

Regras:
1. Gere APENAS questões objetivas (múltipla escolha) — sem dissertativas, verdadeiro/falso ou preenchimento de lacunas.
2. Cada questão deve ter exatamente 4 ou 5 alternativas (A, B, C, D, E).
3. As alternativas devem ser mutuamente exclusivas e uma única deve ser a correta.
4. O campo answers deve conter APENAS a(s) letra(s) da(s) alternativa(s) correta(s) — para questões de resposta única, um único caractere.
5. O campo topic deve identificar o tópico/conteúdo abordado pela questão.
6. As questões devem ser baseadas estritamente no conteúdo fornecido — não invente fatos externos.
7. Varie o nível de dificuldade conforme solicitado.
8. Retorne APENAS um JSON válido no schema abaixo, sem markdown, explicações ou texto fora do JSON.

Schema de saída:
{
  "questions": [
    {
      "question": "texto da pergunta",
      "options": [
        { "key": "A", "text": "texto da alternativa" },
        { "key": "B", "text": "texto da alternativa" },
        { "key": "C", "text": "texto da alternativa" },
        { "key": "D", "text": "texto da alternativa" }
      ],
      "answers": ["A"],
      "topic": "nome do tópico"
    }
  ]
}`;

export async function generateQuestions(
	generationContext: GenerateExamGenerationContext,
	metadata: GenerateExamJobMetadata,
	userId: string,
	db: Parameters<GetAiModelLike>[0]["db"],
	deps: Partial<GenerateQuestionsDeps> = {},
): Promise<GenerateQuestionsResult> {
	const resolveGetAiModel = deps.getAiModel ?? getAiModel;
	const generate = (deps.generateObject ??
		generateObject) as GenerateObjectLike;
	const sleep = defaultSleep;

	let model: Awaited<ReturnType<GetAiModelLike>>;
	try {
		model = await resolveGetAiModel({
			db,
			userId,
			modelId: metadata.modelId,
		});
	} catch (error) {
		return {
			ok: false,
			terminal: {
				error: JOB_ERROR_CODE.MODEL_UNAVAILABLE,
				message: shortErrorMessage(error),
			},
		};
	}

	const callId = createLlmLogCallId("generate-exam-questions");
	const startedAt = Date.now();
	await logLlmCallStart({
		callId,
		userId,
		callType: "generate-exam-questions",
		provider: "openai-compatible",
		model: metadata.modelId,
		systemPrompt: GENERATE_SYSTEM_PROMPT,
		requestPayload: JSON.stringify({
			questionCount: generationContext.questionCount,
			difficulty: generationContext.difficulty,
			difficultyNotes: generationContext.difficultyNotes,
			mainContentLength: generationContext.mainContent.length,
			parsedDocumentCount: generationContext.parsedContextDocuments.length,
		}),
	});

	const difficultyInstruction = buildDifficultyInstruction(
		generationContext.difficulty,
		generationContext.difficultyNotes,
	);

	const parsedDocsText = generationContext.parsedContextDocuments
		.map(
			(doc, i) =>
				`--- Documento ${i + 1}: ${doc.title} (${doc.documentType}) ---\n${doc.summary}\n\nFatos relevantes:\n${doc.facts.map((f) => `- ${f.statement}`).join("\n")}\n\nObjetivos de estudo:\n${doc.studyObjectives.map((o) => `- ${o.description}`).join("\n")}`,
		)
		.join("\n\n");

	const prompt = `Gere exatamente ${generationContext.questionCount} questões objetivas de nível ${difficultyInstruction}.

Conteúdo base:
${generationContext.mainContent}

${parsedDocsText ? `Documentos de contexto:\n${parsedDocsText}` : ""}`;

	for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
		if (attempt > 0) {
			await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS.at(-1)!);
		}

		try {
			const result = await generate({
				model,
				schema: zodSchema(QUESTIONS_OUTPUT_SCHEMA),
				schemaName: "generated_exam_questions",
				schemaDescription:
					"Questões objetivas geradas a partir de conteúdo didático",
				system: GENERATE_SYSTEM_PROMPT,
				prompt,
			});

			const usage =
				"usage" in result && result.usage && typeof result.usage === "object"
					? result.usage
					: undefined;

			const tokenUsage: TokenUsage | undefined = usage
				? {
						inputTokens: (usage as { inputTokens?: number }).inputTokens ?? 0,
						outputTokens:
							(usage as { outputTokens?: number }).outputTokens ?? 0,
						totalTokens: (usage as { totalTokens?: number }).totalTokens ?? 0,
					}
				: undefined;

			const parsed = result.object as { questions?: unknown[] };
			const questions = parsed?.questions ?? [];

			if (questions.length === 0) {
				const isLastAttempt = attempt >= MAX_LLM_RETRIES;
				if (!isLastAttempt) continue;

				await logLlmCallComplete(callId, {
					status: "error",
					durationMs: Date.now() - startedAt,
					errorMessage: "no_questions_generated",
				});

				return {
					ok: false,
					terminal: {
						error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
						message: "O modelo não gerou nenhuma questão objetiva válida.",
					},
				};
			}

			await logLlmCallComplete(callId, {
				status: "success",
				durationMs: Date.now() - startedAt,
				responsePayload: JSON.stringify(result.object),
				tokenMeta: usage
					? JSON.stringify({
							inputTokens: tokenUsage?.inputTokens ?? 0,
							outputTokens: tokenUsage?.outputTokens ?? 0,
							totalTokens: tokenUsage?.totalTokens ?? 0,
						})
					: undefined,
				finalChars: prompt.length,
			});

			return { ok: true, questions, usage: tokenUsage };
		} catch (error) {
			const isLastAttempt = attempt >= MAX_LLM_RETRIES;
			if (!isLastAttempt && isTransientLlmError(error)) {
				continue;
			}

			await logLlmCallComplete(callId, {
				status: "error",
				durationMs: Date.now() - startedAt,
				errorMessage: shortErrorMessage(error),
			});

			return {
				ok: false,
				terminal: {
					error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
					message: `Falha ao gerar questões: ${shortErrorMessage(error)}`,
				},
			};
		}
	}

	await logLlmCallComplete(callId, {
		status: "error",
		durationMs: Date.now() - startedAt,
		errorMessage: "generate_questions_failed",
	});

	return {
		ok: false,
		terminal: {
			error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			message: "Falha ao gerar questões após todas as tentativas.",
		},
	};
}

function buildDifficultyInstruction(
	difficulty: string,
	difficultyNotes?: string,
): string {
	const base: Record<string, string> = {
		easy: "fácil (questões básicas que testam memorização e compreensão direta do conteúdo)",
		medium: "médio (questões que exigem aplicação e interpretação do conteúdo)",
		hard: "difícil (questões que exigem análise, síntese e avaliação crítica do conteúdo)",
	};

	let instruction = base[difficulty] ?? `"${difficulty}"`;
	if (difficultyNotes?.trim()) {
		instruction += `. Observações adicionais sobre a dificuldade: ${difficultyNotes.trim()}`;
	}
	return instruction;
}

import { z } from "zod";

const generatedOptionSchema = z.object({
	key: z
		.string()
		.trim()
		.length(1)
		.regex(/^[A-Z]$/),
	text: z.string().trim().min(1),
});

const generatedQuestionSchema = z
	.object({
		question: z.string().trim().min(1),
		options: z.array(generatedOptionSchema).min(2),
		answers: z.array(z.string()).min(1),
		topic: z.string().trim().min(1),
	})
	.superRefine((data, ctx) => {
		const keys = new Set<string>();
		for (const option of data.options) {
			if (keys.has(option.key)) {
				ctx.addIssue({
					code: "custom",
					message: "duplicate option key",
					path: ["options"],
				});
				return;
			}
			keys.add(option.key);
		}

		for (let i = 0; i < data.answers.length; i++) {
			const answerKey = data.answers[i]?.trim();
			if (!answerKey || !keys.has(answerKey)) {
				ctx.addIssue({
					code: "custom",
					message: "answer key not found in options",
					path: ["answers", i],
				});
			}
		}
	});

const QUESTIONS_OUTPUT_SCHEMA = z.object({
	questions: z.array(generatedQuestionSchema),
});
