import type { UIMessage } from "ai";
import type { ExplanationChange } from "@/features/ai/agents/explanations/explain-question/contracts";
import type { QuestionChange } from "@/features/ai/agents/improve-questions/contracts";
import type {
	BenchmarkPerfMetrics,
	BenchmarkPhaseMetrics,
	StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import type { AgentRunState } from "@/features/ai/pipeline/client";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import type {
	FlowStage,
	IngestAgentRun,
	IngestJob,
	IngestOutputEntry,
	IngestResultEvent,
	TokenTotals,
} from "@/features/ingest/store/types";

export type BackgroundProcessKind =
	| "ingest"
	| "improve-questions"
	| "explain-question"
	| "connection-test"
	| "model-benchmark";

export type BackgroundProcessStatus =
	| "queued"
	| "running"
	| "success"
	| "error"
	| "canceled"
	| "awaiting_review";

export type IngestProcessStatus = Extract<
	BackgroundProcessStatus,
	"queued" | "running" | "success" | "error" | "canceled"
>;

export type ImproveQuestionsRunPhase =
	| "idle"
	| "running"
	| "done"
	| "error"
	| "canceled";

export interface IngestBackgroundProcess {
	kind: "ingest";
	id: string;
	fileName: string;
	status: IngestProcessStatus;
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	stepText: string;
	logs: PipelineLogEntry[];
	outputEntries: IngestOutputEntry[];
	agentRuns: IngestAgentRun[];
	tokenTotals: TokenTotals;
	nonAgentTokenTotals: TokenTotals;
	warnings: string[];
	result: IngestResultEvent | null;
	error: string | null;
	stages: FlowStage[];
	buffer: number[];
	enableReview: boolean;
	enableExplanations: boolean;
	agentConcurrency: number;
	rawStreamText: string;
}

export interface ImproveQuestionsBackgroundProcess {
	kind: "improve-questions";
	id: string;
	status: BackgroundProcessStatus;
	questionId: number;
	examId: number;
	originalSnapshot: QuestionData;
	draftQuestion: QuestionData;
	agentRunState: AgentRunState | null;
	changes: QuestionChange[];
	isStreaming: boolean;
	streamError: string | null;
	phase: ImproveQuestionsRunPhase;
	logs: PipelineLogEntry[];
	stepText: string;
}

export type ExplainQuestionRunPhase =
	| "idle"
	| "running"
	| "done"
	| "error"
	| "canceled";

export interface ExplainQuestionBackgroundProcess {
	kind: "explain-question";
	id: string;
	status: BackgroundProcessStatus;
	questionId: number;
	examId: number;
	originalSnapshot: QuestionData;
	explanation: string;
	deepExplanation: string;
	overwrite: boolean;
	agentRunState: AgentRunState | null;
	changes: ExplanationChange[];
	isStreaming: boolean;
	streamError: string | null;
	phase: ExplainQuestionRunPhase;
	createdAt: number;
	finishedAt: number | null;
	logs: PipelineLogEntry[];
	stepText: string;
}

export interface ConnectionTestBackgroundProcess {
	kind: "connection-test";
	id: string;
	modelId: number;
	modelDisplayName: string;
	providerName: string | null;
	status: BackgroundProcessStatus;
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	progress: number;
	step: string;
	stepText: string;
	logs: PipelineLogEntry[];
	prompt: string;
	response: string;
	messages: UIMessage[];
	error: string | null;
	tokenTotals: TokenTotals | null;
	streamMetrics: StreamPerfMetrics;
}

export interface ModelBenchmarkBackgroundProcess {
	kind: "model-benchmark";
	id: string;
	modelId: number;
	modelDisplayName: string;
	providerName: string | null;
	testMode: "benchmark";
	status: BackgroundProcessStatus;
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	progress: number;
	step: string;
	stepText: string;
	logs: PipelineLogEntry[];
	error: string | null;
	tokenTotals: TokenTotals | null;
	streamMetrics: StreamPerfMetrics;
	benchmarkMetrics: BenchmarkPerfMetrics;
	phases: BenchmarkPhaseMetrics[];
	allPhasesPassed: boolean | null;
	messages: UIMessage[];
}

export type BackgroundProcess =
	| IngestBackgroundProcess
	| ImproveQuestionsBackgroundProcess
	| ExplainQuestionBackgroundProcess
	| ConnectionTestBackgroundProcess
	| ModelBenchmarkBackgroundProcess;

interface ImproveQuestionsBatchConfig {
	maxWorkers: number;
}

export interface ImproveQuestionsExamUiState {
	batchDialogOpen: boolean;
	questionDialogQuestionId: number | null;
}

export interface ExplainQuestionsBatchConfig {
	maxWorkers: number;
}

export interface ExplainQuestionsExamUiState {
	batchDialogOpen: boolean;
	questionDialogQuestionId: number | null;
}

export interface BackgroundProcessStoreState {
	processes: BackgroundProcess[];
	focusedProcessId: string | null;
	improveQuestionsBatchByExam: Record<number, ImproveQuestionsBatchConfig>;
	improveQuestionsUiByExam: Record<number, ImproveQuestionsExamUiState>;
	explainQuestionsBatchByExam: Record<number, ExplainQuestionsBatchConfig>;
	explainQuestionsUiByExam: Record<number, ExplainQuestionsExamUiState>;
}

export interface PersistedIngestProcess
	extends Omit<IngestBackgroundProcess, "buffer"> {
	buffer?: number[];
}

export type PersistedConnectionTestProcess = ConnectionTestBackgroundProcess;

export type PersistedModelBenchmarkProcess = ModelBenchmarkBackgroundProcess;

export type PersistedBackgroundProcess =
	| PersistedIngestProcess
	| PersistedConnectionTestProcess
	| PersistedModelBenchmarkProcess;

export interface PersistedBackgroundProcessState {
	processes: PersistedBackgroundProcess[];
	focusedProcessId: string | null;
}

export const BACKGROUND_PROCESS_STORAGE_KEY = "background-processes";
export const LEGACY_INGEST_STORAGE_KEY = "ingest-jobs";

const ACTIVE_STATUSES: BackgroundProcessStatus[] = [
	"queued",
	"running",
	"awaiting_review",
];

const COMPLETED_STATUSES: BackgroundProcessStatus[] = [
	"success",
	"error",
	"canceled",
];

export const MAX_RECENT_COMPLETED_PROCESSES = 10;

export function ingestProcessId(jobId: string): string {
	return jobId.startsWith("ingest:") ? jobId : `ingest:${jobId}`;
}

export function improveQuestionsProcessId(questionId: number): string {
	return `improve-questions:${questionId}`;
}

export function explainQuestionProcessId(questionId: number): string {
	return `explain-question:${questionId}`;
}

export function connectionTestProcessId(modelId: number): string {
	return `connection-test:${modelId}`;
}

export function modelBenchmarkProcessId(modelId: number): string {
	return `model-benchmark:${modelId}`;
}

export function parseIngestProcessId(id: string): string | null {
	return id.startsWith("ingest:") ? id.slice("ingest:".length) : null;
}

export function parseImproveQuestionsProcessId(id: string): number | null {
	if (!id.startsWith("improve-questions:")) return null;
	const questionId = Number(id.slice("improve-questions:".length));
	return Number.isFinite(questionId) ? questionId : null;
}

export function parseExplainQuestionProcessId(id: string): number | null {
	if (!id.startsWith("explain-question:")) return null;
	const questionId = Number(id.slice("explain-question:".length));
	return Number.isFinite(questionId) ? questionId : null;
}

export function parseConnectionTestProcessId(id: string): number | null {
	if (!id.startsWith("connection-test:")) return null;
	const modelId = Number(id.slice("connection-test:".length));
	return Number.isFinite(modelId) ? modelId : null;
}

export function parseModelBenchmarkProcessId(id: string): number | null {
	if (!id.startsWith("model-benchmark:")) return null;
	const modelId = Number(id.slice("model-benchmark:".length));
	return Number.isFinite(modelId) ? modelId : null;
}

export function isIngestProcess(
	process: BackgroundProcess,
): process is IngestBackgroundProcess {
	return process.kind === "ingest";
}

export function isImproveQuestionsProcess(
	process: BackgroundProcess,
): process is ImproveQuestionsBackgroundProcess {
	return process.kind === "improve-questions";
}

export function isExplainQuestionProcess(
	process: BackgroundProcess,
): process is ExplainQuestionBackgroundProcess {
	return process.kind === "explain-question";
}

export function isConnectionTestProcess(
	process: BackgroundProcess,
): process is ConnectionTestBackgroundProcess {
	return process.kind === "connection-test";
}

export function isModelBenchmarkProcess(
	process: BackgroundProcess,
): process is ModelBenchmarkBackgroundProcess {
	return process.kind === "model-benchmark";
}

export function isActiveProcess(process: BackgroundProcess): boolean {
	return ACTIVE_STATUSES.includes(process.status);
}

export function isCompletedProcess(process: BackgroundProcess): boolean {
	return COMPLETED_STATUSES.includes(process.status);
}

export function getActiveProcesses(
	processes: BackgroundProcess[],
): BackgroundProcess[] {
	return processes.filter(isActiveProcess);
}

export function getRecentProcesses(
	processes: BackgroundProcess[],
	limit = MAX_RECENT_COMPLETED_PROCESSES,
): BackgroundProcess[] {
	const active = getActiveProcesses(processes);
	const completed = processes
		.filter(isCompletedProcess)
		.sort(
			(left, right) => getProcessFinishedAt(right) - getProcessFinishedAt(left),
		)
		.slice(0, limit);
	return [...active, ...completed];
}

function getProcessFinishedAt(process: BackgroundProcess): number {
	if (process.kind === "ingest") {
		return process.finishedAt ?? process.createdAt;
	}
	if (process.kind === "explain-question") {
		return process.finishedAt ?? process.createdAt;
	}
	if (
		process.kind === "connection-test" ||
		process.kind === "model-benchmark"
	) {
		return process.finishedAt ?? process.createdAt;
	}
	return 0;
}

export function ingestJobToProcess(job: IngestJob): IngestBackgroundProcess {
	return {
		kind: "ingest",
		...job,
		id: ingestProcessId(job.id),
	};
}

export function ingestProcessToJob(
	process: IngestBackgroundProcess,
): IngestJob {
	const { kind: _kind, ...job } = process;
	const rawId = parseIngestProcessId(process.id) ?? process.id;
	return { ...job, id: rawId };
}
