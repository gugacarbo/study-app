import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";

export function formatDate(dateStr: string | null): string {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
}

export function formatFileSize(bytes: number | null): string {
	if (bytes === null || bytes === undefined) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function accuracyColor(accuracy: number): string {
	if (accuracy >= 70) return "text-success";
	if (accuracy >= 40) return "text-warning";
	return "text-error";
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string") return error;
	return "Erro desconhecido";
}

export function chunkIds(ids: number[], chunkSize: number): number[][] {
	const chunks: number[][] = [];
	for (let idx = 0; idx < ids.length; idx += chunkSize) {
		chunks.push(ids.slice(idx, idx + chunkSize));
	}
	return chunks;
}

export type ExplanationProgressStatus =
	| "pending"
	| "processing"
	| "done"
	| "error"
	| "skipped";

export interface ExplanationProgressItem {
	id: number;
	question: string;
	status: ExplanationProgressStatus;
	message?: string;
	response?: {
		explanation: string;
		deepExplanation: string;
		agentRun?: ExplanationAgentRunSummary;
	};
}

export interface EditFormData {
	question: string;
	options: string[];
	answer: string;
	explanation: string;
	deepExplanation: string;
	topic: string;
}

export interface QuestionData {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	answer: string;
	explanation: string;
	deepExplanation: string;
	topic: string;
}
