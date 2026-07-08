import { generateObject, zodSchema } from "ai";
import { getAiModel } from "@/lib/ai-config";
import { JOB_ERROR_CODE, type JobErrorBody } from "@/lib/job-errors";
import type { GenerateExamJobMetadata } from "@/lib/job-kinds";
import {
	createLlmLogCallId,
	logLlmCallComplete,
	logLlmCallStart,
} from "@/lib/llm-logging";
import {
	type ParsedContextDocument,
	parsedContextDocumentSchema,
	parseParsedContextDocument,
} from "./parser-schema";
import type { GenerateExamContextFile } from "./types";

export type ParseContextFileResult =
	| { ok: true; document: ParsedContextDocument }
	| { ok: false; terminal: JobErrorBody };

export type GenerateObjectLike = (
	options: object,
) => Promise<{ object: unknown; usage?: unknown }>;

export type GetAiModelLike = (input: {
	db: Parameters<typeof getAiModel>[0]["db"];
	userId: string;
	modelId?: string;
}) => Promise<Awaited<ReturnType<typeof getAiModel>>>;

export type ParseContextFileDeps = {
	getAiModel: GetAiModelLike;
	generateObject: GenerateObjectLike;
	logLlmCallStart?: typeof logLlmCallStart;
	logLlmCallComplete?: typeof logLlmCallComplete;
};

const MAX_LLM_RETRIES = 2;
const RETRY_BACKOFF_MS = [500, 1500] as const;
const textEncoder = new TextEncoder();

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

export function buildParseContextFileDeps(
	modelId: string,
): ParseContextFileDeps {
	return {
		getAiModel: async (input) => getAiModel({ ...input, modelId }),
		generateObject: generateObject as GenerateObjectLike,
	};
}

const PARSER_SYSTEM_PROMPT = `Você é um parser estrito de documentos didáticos universitários. Receberá o texto bruto de um arquivo de contexto e deve devolver APENAS um JSON válido no schema exato abaixo, sem nenhum markdown, explicação ou texto fora do JSON.

Schema obrigatório:
- schemaVersion: "1"
- sourceFileId: id do arquivo fornecido
- title: título curto e representativo do documento
- documentType: uma das: notes, syllabus, handout, exercise-list, exam-reference, mixed
- summary: resumo geral do documento (1-3 parágrafos)
- rawText: o texto bruto completo recebido
- sections: array de seções, cada uma com id único, title, level (1, 2, ...), summary, topicRefs (ids de tópicos referenciados), keyPoints, sourceSpan { sectionLabel, excerpt }, confidence (high/medium/low)
- topics: array de tópicos com id único, name, summary, keywords, sectionRefs (ids de seções), sourceSpans, confidence
- facts: array de fatos com statement, importance (high/medium/low), topicRefs, sourceSpan, confidence
- studyObjectives: array de objetivos de estudo com description, topicRefs, sourceSpan, confidence
- glossary: array de entradas de glossário com term, definition, topicRefs, sourceSpan, confidence
- warnings: array de strings (vazio se não houver)

Regras rígidas:
1. Todos os ids devem ser únicos dentro do documento.
2. Toda topicRef em sections/facts/studyObjectives/glossary deve existir em topics.
3. Toda sectionRef em topics deve existir em sections.
4. Não omita rawText: ele deve ser o texto completo recebido.
5. Se não houver seções, crie pelo menos uma seção genérica com id "sec-1".
6. Se não houver tópicos, crie pelo menos um tópico genérico com id "topic-1".
7. Não retorne markdown nem comentários fora do JSON.`;

export async function parseContextFile(
	file: GenerateExamContextFile,
	metadata: GenerateExamJobMetadata,
	userId: string,
	db: Parameters<GetAiModelLike>[0]["db"],
	deps: Partial<ParseContextFileDeps> = {},
): Promise<ParseContextFileResult> {
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

	const callId = createLlmLogCallId("generate-exam-parse");
	const startedAt = Date.now();
	await logLlmCallStart({
		callId,
		userId,
		callType: "generate-exam-parse",
		provider: "openai-compatible",
		model: metadata.modelId,
		systemPrompt: PARSER_SYSTEM_PROMPT,
		requestPayload: file.text.slice(0, 5000),
	});

	const prompt = `Arquivo: ${file.fileName}\nID do arquivo: ${file.fileId}\n\nTexto bruto:\n${file.text}`;

	for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
		if (attempt > 0) {
			await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS.at(-1)!);
		}

		try {
			const result = await generate({
				model,
				schema: zodSchema(parsedContextDocumentSchema),
				schemaName: "parsed_context_document",
				schemaDescription: "Documento didático parseado em JSON canônico",
				system: PARSER_SYSTEM_PROMPT,
				prompt,
			});

			const usage =
				"usage" in result && result.usage && typeof result.usage === "object"
					? result.usage
					: undefined;

			const parsed = parseParsedContextDocument(result.object);

			if (!parsed.ok) {
				await logLlmCallComplete(callId, {
					status: "error",
					durationMs: Date.now() - startedAt,
					errorMessage: "invalid_context_parse",
				});
				return {
					ok: false,
					terminal: {
						error: JOB_ERROR_CODE.INVALID_CONTEXT_PARSE,
						message: `O parser não produziu um JSON canônico válido para ${file.fileName}.`,
					},
				};
			}

			const document = parsed.data;
			const documentWithSource: ParsedContextDocument = {
				...document,
				sourceFileId: file.fileId,
			};

			await logLlmCallComplete(callId, {
				status: "success",
				durationMs: Date.now() - startedAt,
				responsePayload: JSON.stringify(result.object),
				tokenMeta: usage
					? JSON.stringify({
							inputTokens: (usage as { inputTokens?: number }).inputTokens ?? 0,
							outputTokens:
								(usage as { outputTokens?: number }).outputTokens ?? 0,
							totalTokens: (usage as { totalTokens?: number }).totalTokens ?? 0,
						})
					: undefined,
				finalChars: file.text.length,
			});

			return { ok: true, document: documentWithSource };
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
					error: JOB_ERROR_CODE.CONTEXT_PARSE_FAILED,
					message: `Falha ao processar ${file.fileName}: ${shortErrorMessage(error)}`,
				},
			};
		}
	}

	await logLlmCallComplete(callId, {
		status: "error",
		durationMs: Date.now() - startedAt,
		errorMessage: "context_parse_failed",
	});

	return {
		ok: false,
		terminal: {
			error: JOB_ERROR_CODE.CONTEXT_PARSE_FAILED,
			message: `Falha ao processar ${file.fileName} após todas as tentativas.`,
		},
	};
}
