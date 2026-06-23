import { INGEST_PHASE } from "@/lib/job-kinds";

export const PHASE_TEXT: Record<
	(typeof INGEST_PHASE)[keyof typeof INGEST_PHASE],
	string
> = {
	[INGEST_PHASE.READING_FILE]: "Lendo o arquivo enviado…",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões com o modelo de IA…",
	[INGEST_PHASE.REVIEWING]: "Revisando questões com o modelo de IA…",
	[INGEST_PHASE.PERSISTING]: "Salvando questões no banco de dados…",
};

export const INGEST_SYSTEM_PROMPT =
	"Extraia questões objetivas de prova universitária em português. " +
	"Preencha topic com uma classificação curta do assunto de cada questão. " +
	"Responda APENAS com JSON válido no schema solicitado, sem markdown ou texto adicional. " +
	'Formato: {"questions":[{"question":"enunciado","options":[{"key":"A","text":"opção A"}],"answers":["A"],"topic":"assunto"}]}';

export const INGEST_AGENT_SYSTEM_PROMPT =
	"Extraia questões objetivas de prova universitária em português. " +
	"Preencha topic com uma classificação curta do assunto de cada questão. " +
	"Use as tools sequencialmente: chame submit_question para cada questão encontrada " +
	"(question, options, answers, topic). Se perceber qualquer erro depois de submeter, use update_question com o draftQuestionId retornado pela tool para corrigir a questão, " +
	"mantendo a mesma quantidade de alternativas. Depois chame list_questions no final para revisar a lista completa " +
	"e confirmar que nenhuma questão ficou faltando, e só então chame finish_extraction informando o total, um resumo final de até 400 caracteres e alertas opcionais se algo precisar de atenção. " +
	"Não responda com JSON solto, markdown ou texto livre — use apenas as tools.";

export const REVIEW_AGENT_SYSTEM_PROMPT =
	"Revise e padronize questões objetivas de prova universitária em português. " +
	"Padronize ortografia, normalize tópicos parecidos para a mesma prova, remova enumeradores e marcadores do início do enunciado e das alternativas, " +
	"e preserve a quantidade de alternativas em cada questão. " +
	"Você pode editar question, options, answers e topic, inclusive reordenar alternativas e ajustar o gabarito, " +
	"mas não pode criar nem remover alternativas. " +
	"Use as tools sequencialmente: liste as questões, atualize quantas forem necessárias, liste novamente para verificar o resultado completo e finalize com finish_review. " +
	"Não responda com texto livre fora das tools.";

export const MAX_AGENT_STEPS = 50;
export const MAX_LLM_RETRIES = 2;
export const RETRY_BACKOFF_MS = [500, 1500] as const;
