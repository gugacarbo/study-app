import {
	IMPROVE_BATCH_PHASE,
	IMPROVE_QUESTION_STAGE,
	type ImproveBatchPhase,
	type ImproveQuestionStage,
} from "@/lib/job-kinds";

const IMPROVE_STAGE_LABELS: Record<ImproveQuestionStage, string> = {
	[IMPROVE_QUESTION_STAGE.QUEUED]: "Na fila",
	[IMPROVE_QUESTION_STAGE.LOADING_QUESTION]: "Carregando questão",
	[IMPROVE_QUESTION_STAGE.RESEARCHING]: "Pesquisando",
	[IMPROVE_QUESTION_STAGE.DRAFTING]: "Escrevendo melhoria",
	[IMPROVE_QUESTION_STAGE.WRITING_EXPLANATIONS]: "Escrevendo explicações",
	[IMPROVE_QUESTION_STAGE.SAVING_DRAFT]: "Salvando draft",
};

const IMPROVE_BATCH_LABELS: Record<ImproveBatchPhase, string> = {
	[IMPROVE_BATCH_PHASE.PREPARING_BATCH]: "Preparar lote",
	[IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS]: "Despachar agentes",
	[IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS]: "Processar questões",
	[IMPROVE_BATCH_PHASE.FINALIZING_BATCH]: "Finalizar lote",
};

export function formatImproveQuestionStageLabel(stage: ImproveQuestionStage): string {
	return IMPROVE_STAGE_LABELS[stage] ?? stage;
}

export function formatImproveBatchPhaseLabel(phase: ImproveBatchPhase): string {
	return IMPROVE_BATCH_LABELS[phase] ?? phase;
}
