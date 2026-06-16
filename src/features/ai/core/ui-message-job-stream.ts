import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	type UIMessageStreamOnFinishCallback,
	type UIMessageStreamWriter,
} from "ai";
import { mergeStreamResponseHeaders } from "@/features/ai/lib/stream-response-headers";
import {
	TRANSIENT_UI_DATA_PARTS,
	type AgentRunDataPart,
	type ExplanationUpdateDataPart,
	type JobErrorDataPart,
	type JobProgressDataPart,
	type JobResultDataPart,
	type ProcessLogDataPart,
	type StageDataPart,
	type StudyAppUIDataParts,
	type StudyAppUIMessage,
	type StudyAppUIMessageChunk,
	type WorkspaceUpdateDataPart,
} from "@/features/ai/types/ui-message-data-parts";

export type JobUIMessageStreamWriter = UIMessageStreamWriter<StudyAppUIMessage>;

export interface JobUIMessageStreamOptions {
	execute: (options: { writer: JobUIMessageStreamWriter }) => Promise<void> | void;
	onFinish?: UIMessageStreamOnFinishCallback<StudyAppUIMessage>;
	onError?: (error: unknown) => string;
}

export function createJobUIMessageStream(
	options: JobUIMessageStreamOptions,
): ReadableStream<StudyAppUIMessageChunk> {
	return createUIMessageStream<StudyAppUIMessage>({
		execute: options.execute,
		onFinish: options.onFinish,
		onError: options.onError,
	});
}

export function createJobUIMessageStreamResponse(
	stream: ReadableStream<StudyAppUIMessageChunk>,
	init?: ResponseInit,
): Response {
	return createUIMessageStreamResponse({
		stream,
		...init,
		headers: mergeStreamResponseHeaders(init?.headers),
	});
}

type DataPartName = keyof StudyAppUIDataParts;

function writeStudyDataPart<NAME extends DataPartName>(
	writer: JobUIMessageStreamWriter,
	name: NAME,
	data: NAME extends "stage"
		? StageDataPart
		: NAME extends "agent-run"
			? AgentRunDataPart
		: NAME extends "workspace-update"
			? WorkspaceUpdateDataPart
			: NAME extends "explanation-update"
				? ExplanationUpdateDataPart
				: NAME extends "job-progress"
					? JobProgressDataPart
					: NAME extends "job-result"
						? JobResultDataPart
						: NAME extends "job-error"
							? JobErrorDataPart
							: NAME extends "process-log"
								? ProcessLogDataPart
								: never,
	options?: { id?: string },
): void {
	const transient = TRANSIENT_UI_DATA_PARTS.has(name);
	writer.write({
		type: `data-${name}`,
		id: options?.id,
		data,
		...(transient ? { transient: true } : {}),
	} as StudyAppUIMessageChunk);
}

export function writeStage(
	writer: JobUIMessageStreamWriter,
	data: StageDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(writer, "stage", data, options);
}

export function writeAgentRun(
	writer: JobUIMessageStreamWriter,
	data: AgentRunDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(writer, "agent-run", data, options);
}

export function writeWorkspaceUpdate(
	writer: JobUIMessageStreamWriter,
	data: WorkspaceUpdateDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(writer, "workspace-update", data, options);
}

export function writeExplanationUpdate(
	writer: JobUIMessageStreamWriter,
	data: ExplanationUpdateDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(writer, "explanation-update", data, options);
}

export function writeJobProgress(
	writer: JobUIMessageStreamWriter,
	data: JobProgressDataPart,
): void {
	writeStudyDataPart(writer, "job-progress", data);
}

export function writeJobResult(
	writer: JobUIMessageStreamWriter,
	data: JobResultDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(writer, "job-result", data, options);
}

export function writeJobError(
	writer: JobUIMessageStreamWriter,
	data: JobErrorDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(writer, "job-error", data, options);
}

export function writeProcessLog(
	writer: JobUIMessageStreamWriter,
	data: ProcessLogDataPart,
	options?: { id?: string },
): void {
	writeStudyDataPart(
		writer,
		"process-log",
		{
			...data,
			timestamp: data.timestamp ?? Date.now(),
		},
		options,
	);
}

export interface AgentRunDescriptor {
	stageId: string;
	agentRunId: string;
	label: string;
}

export function createAgentRunWriter(writer: JobUIMessageStreamWriter) {
	let runCounter = 0;

	const emit = (data: AgentRunDataPart) => {
		writeAgentRun(writer, data, { id: data.agentRunId });
	};

	return {
		allocateAgentRunId(stageId: string): string {
			runCounter += 1;
			return `${stageId}-${runCounter}`;
		},
		createRun(stageId: string, label: string): AgentRunDescriptor {
			runCounter += 1;
			return { stageId, label, agentRunId: `${stageId}-${runCounter}` };
		},
		lifecycle(
			run: AgentRunDescriptor,
			status: AgentRunDataPart["status"],
			meta?: Omit<
				AgentRunDataPart,
				| "eventType"
				| "stageId"
				| "agentRunId"
				| "label"
				| "timestamp"
				| "status"
			>,
		) {
			emit({
				eventType: "lifecycle",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				status,
				timestamp: Date.now(),
				...meta,
			});
		},
		result(
			run: AgentRunDescriptor,
			finalObject: unknown,
			rawText?: string,
			meta?: Record<string, unknown>,
		) {
			emit({
				eventType: "result",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				finalObject,
				rawText,
				timestamp: Date.now(),
				meta,
			});
		},
		warning(
			run: AgentRunDescriptor,
			warning: string,
			meta?: Record<string, unknown>,
		) {
			emit({
				eventType: "warning",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				warning,
				timestamp: Date.now(),
				meta,
			});
		},
		textDelta(run: AgentRunDescriptor, delta: string) {
			if (!delta) return;
			emit({
				eventType: "token",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				rawText: delta,
				timestamp: Date.now(),
			});
		},
		reasoningDelta(run: AgentRunDescriptor, delta: string) {
			if (!delta) return;
			emit({
				eventType: "token",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				rawText: delta,
				meta: { kind: "reasoning" },
				timestamp: Date.now(),
			});
		},
		token(
			run: AgentRunDescriptor,
			tokens: unknown,
			meta?: Record<string, unknown>,
		) {
			emit({
				eventType: "token",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				tokens,
				timestamp: Date.now(),
				meta,
			});
		},
		toolCall(
			run: AgentRunDescriptor,
			tool: Pick<
				AgentRunDataPart,
				"name" | "arguments" | "input" | "output" | "state"
			>,
			meta?: Record<string, unknown>,
		) {
			emit({
				eventType: "tool-call",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				timestamp: Date.now(),
				...tool,
				meta,
			});
		},
		toolResult(
			run: AgentRunDescriptor,
			result: Pick<AgentRunDataPart, "content" | "error" | "state">,
			meta?: Record<string, unknown>,
		) {
			emit({
				eventType: "tool-result",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				timestamp: Date.now(),
				...result,
				meta,
			});
		},
	};
}
