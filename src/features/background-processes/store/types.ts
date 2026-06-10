import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import type { QuestionChange } from "@/features/ai/agents/improve-questions/contracts";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import type { ExplanationProgressItem } from "@/features/exams/components/detail/exam-utils";
import type {
	FlowStage,
	IngestAgentRun,
	IngestJob,
	IngestLogEntry,
	IngestOutputEntry,
	IngestResultEvent,
	TokenTotals,
} from "@/features/ingest/store/types";

export type BackgroundProcessKind =
	| "ingest"
	| "improve-questions"
	| "explanation-generation";

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
	logs: IngestLogEntry[];
	outputEntries: IngestOutputEntry[];
	agentRuns: IngestAgentRun[];
	tokenTotals: TokenTotals;
	nonAgentTokenTotals: TokenTotals;
	warnings: string[];
	result: IngestResultEvent | null;
	error: string | null;
	flowStages: FlowStage[];
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
}

export interface ExplanationQuestionSnapshot {
	id: number;
	question: string;
	explanation: string;
	deepExplanation: string;
}

export interface ExplanationGenerationBackgroundProcess {
	kind: "explanation-generation";
	id: string;
	examId: number;
	status: BackgroundProcessStatus;
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	progressItems: ExplanationProgressItem[];
	agentRuns: ExplanationAgentRunSummary[];
	batchSize: number;
	overwriteExplanations: boolean;
	generationMessage: string | null;
	questions: ExplanationQuestionSnapshot[];
}

export type BackgroundProcess =
	| IngestBackgroundProcess
	| ImproveQuestionsBackgroundProcess
	| ExplanationGenerationBackgroundProcess;

export interface BackgroundProcessStoreState {
	processes: BackgroundProcess[];
	focusedProcessId: string | null;
}

export interface PersistedIngestProcess
	extends Omit<IngestBackgroundProcess, "buffer"> {
	buffer?: number[];
}

export interface PersistedBackgroundProcessState {
	processes: PersistedIngestProcess[];
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

export function explanationGenerationProcessId(examId: number): string {
	return `explanation-generation:${examId}`;
}

export function parseIngestProcessId(id: string): string | null {
	return id.startsWith("ingest:") ? id.slice("ingest:".length) : null;
}

export function parseImproveQuestionsProcessId(id: string): number | null {
	if (!id.startsWith("improve-questions:")) return null;
	const questionId = Number(id.slice("improve-questions:".length));
	return Number.isFinite(questionId) ? questionId : null;
}

export function parseExplanationGenerationProcessId(id: string): number | null {
	if (!id.startsWith("explanation-generation:")) return null;
	const examId = Number(id.slice("explanation-generation:".length));
	return Number.isFinite(examId) ? examId : null;
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

export function isExplanationGenerationProcess(
	process: BackgroundProcess,
): process is ExplanationGenerationBackgroundProcess {
	return process.kind === "explanation-generation";
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
		.sort((left, right) => getProcessFinishedAt(right) - getProcessFinishedAt(left))
		.slice(0, limit);
	return [...active, ...completed];
}

function getProcessFinishedAt(process: BackgroundProcess): number {
	if (process.kind === "ingest" || process.kind === "explanation-generation") {
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

export function ingestProcessToJob(process: IngestBackgroundProcess): IngestJob {
	const { kind: _kind, ...job } = process;
	const rawId = parseIngestProcessId(process.id) ?? process.id;
	return { ...job, id: rawId };
}
