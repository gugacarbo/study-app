import { INGEST_PHASE } from "@/lib/job-kinds";

export const PHASE_TEXT: Record<
	(typeof INGEST_PHASE)[keyof typeof INGEST_PHASE],
	string
> = {
	[INGEST_PHASE.READING_FILE]: "Lendo o arquivo enviado…",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões com o modelo de IA…",
	[INGEST_PHASE.PERSISTING]: "Salvando questões no banco de dados…",
};

export const INGEST_SYSTEM_PROMPT =
	"Extraia questões objetivas de prova universitária em português. " +
	"Preencha topic com uma classificação curta do assunto de cada questão. " +
	"Responda APENAS com JSON válido no schema solicitado, sem markdown ou texto adicional. " +
	'Formato: {"questions":[{"question":"enunciado","options":[{"key":"A","text":"opção A"}],"answers":["A"],"topic":"assunto"}]}';

export const MAX_LLM_RETRIES = 2;
export const RETRY_BACKOFF_MS = [500, 1500] as const;
