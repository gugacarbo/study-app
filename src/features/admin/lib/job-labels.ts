import {
	INGEST_PHASE,
	JOB_KIND,
	JOB_STATUS,
	type JobKind,
	type JobStatus,
} from "@/lib/job-kinds";

export const JOB_KIND_LABELS: Record<JobKind, string> = {
	[JOB_KIND.INGEST]: "Ingestão",
	[JOB_KIND.EXPLAIN_QUESTION]: "Explicação",
	[JOB_KIND.CONNECTION_TEST]: "Teste de conexão",
	[JOB_KIND.MODEL_BENCHMARK]: "Benchmark",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
	[JOB_STATUS.AWAITING_UPLOAD]: "Aguardando upload",
	[JOB_STATUS.QUEUED]: "Na fila",
	[JOB_STATUS.RUNNING]: "Em execução",
	[JOB_STATUS.COMPLETED]: "Concluído",
	[JOB_STATUS.FAILED]: "Falhou",
	[JOB_STATUS.CANCELLED]: "Cancelado",
};

export const INGEST_PHASE_LABELS: Record<string, string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo arquivo",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões",
	[INGEST_PHASE.REVIEWING]: "Revisando questões",
	[INGEST_PHASE.PERSISTING]: "Salvando questões",
};

export function formatJobKind(kind: string): string {
	return JOB_KIND_LABELS[kind as JobKind] ?? kind;
}

export function formatJobStatus(status: string): string {
	return JOB_STATUS_LABELS[status as JobStatus] ?? status;
}

export function formatJobPhase(phase: string | null): string | null {
	if (!phase) return null;
	return INGEST_PHASE_LABELS[phase] ?? phase;
}

export function formatJobTimestamp(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("pt-BR");
}

export function truncateText(value: string | null, max = 48): string {
	if (!value) return "—";
	if (value.length <= max) return value;
	return `${value.slice(0, max)}…`;
}
