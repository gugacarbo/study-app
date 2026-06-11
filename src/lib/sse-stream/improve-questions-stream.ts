import type {
	DraftQuestion,
	ImproveQuestionsAgentEvent,
	ImproveQuestionsAgentRunSummary,
	ImproveQuestionsDoneEvent,
	WorkspaceUpdateEvent,
} from "@/features/ai/agents/improve-questions/contracts";
import { parseEventBlock } from "./parser";

function normalizeDoneEvent(raw: unknown): ImproveQuestionsDoneEvent | null {
	if (typeof raw !== "object" || raw == null) return null;
	const data = raw as Record<string, unknown>;

	if (data.finalQuestion && data.agentRun) {
		return {
			finalQuestion: data.finalQuestion as DraftQuestion,
			agentRun: data.agentRun as ImproveQuestionsAgentRunSummary,
		};
	}

	if (data.question && data.agentRun) {
		return {
			finalQuestion: data.question as DraftQuestion,
			agentRun: data.agentRun as ImproveQuestionsAgentRunSummary,
		};
	}

	return null;
}

export type ImproveQuestionsTextChunk = {
	text: string;
	kind?: "text" | "reasoning";
	agentRunId?: string;
};

type ImproveQuestionsCallbacks = {
	onAgent?: (event: ImproveQuestionsAgentEvent) => void;
	onChunk?: (chunk: ImproveQuestionsTextChunk) => void;
	onWorkspaceUpdate?: (event: WorkspaceUpdateEvent) => void;
	onDone?: (event: ImproveQuestionsDoneEvent) => void;
};

function dispatchChunk(
	raw: unknown,
	callbacks: ImproveQuestionsCallbacks,
): void {
	if (typeof raw !== "object" || raw == null) return;
	const data = raw as {
		text?: string;
		kind?: "text" | "reasoning";
		agentRunId?: string;
	};
	if (!data.text) return;
	callbacks.onChunk?.({
		text: data.text,
		kind: data.kind === "reasoning" ? "reasoning" : "text",
		agentRunId: data.agentRunId,
	});
}

function dispatchAgentEvent(
	raw: unknown,
	callbacks: ImproveQuestionsCallbacks,
): void {
	if (typeof raw !== "object" || raw == null) return;
	const event = raw as Partial<ImproveQuestionsAgentEvent>;
	if (!event.agentRunId || !event.stageId || !event.label) return;
	callbacks.onAgent?.({
		eventType: event.eventType ?? "lifecycle",
		stageId: event.stageId,
		agentRunId: event.agentRunId,
		label: event.label,
		timestamp: event.timestamp ?? Date.now(),
		status: event.status,
		systemPrompt: event.systemPrompt,
		userPrompt: event.userPrompt,
		rawText: event.rawText,
		finalObject: event.finalObject,
		error: event.error,
		warning: event.warning,
		tokens: event.tokens,
		state: event.state,
		name: event.name,
		arguments: event.arguments,
		input: event.input,
		output: event.output,
		content: event.content,
		meta: event.meta,
	});
}

export async function improveQuestionsStream(
	payload: { questionId: number; signal?: AbortSignal },
	callbacks: ImproveQuestionsCallbacks,
): Promise<ImproveQuestionsDoneEvent> {
	const res = await fetch("/api/improve-questions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ questionId: payload.questionId }),
		signal: payload.signal,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `Improve question failed (${res.status})`);
	}
	if (!res.body) {
		throw new Error("Improve question stream is not available");
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	const doneRef = { current: null as ImproveQuestionsDoneEvent | null };
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx = buffer.indexOf("\n\n");
		while (idx >= 0) {
			const block = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 2);
			if (block) {
				const parsed = parseEventBlock(block);
				if (parsed) {
					let data: unknown;
					try {
						data = JSON.parse(parsed.data);
					} catch {
						data = null;
					}

					if (parsed.event === "agent") {
						dispatchAgentEvent(data, callbacks);
					} else if (parsed.event === "chunk") {
						dispatchChunk(data, callbacks);
					} else if (
						parsed.event === "workspace-update" &&
						typeof data === "object" &&
						data
					) {
						callbacks.onWorkspaceUpdate?.(data as WorkspaceUpdateEvent);
					} else if (parsed.event === "done") {
						const doneEvent = normalizeDoneEvent(data);
						if (doneEvent) {
							doneRef.current = doneEvent;
							callbacks.onDone?.(doneEvent);
						}
					} else if (parsed.event === "error" && typeof data === "object" && data) {
						throw new Error(
							(data as { message?: string }).message ??
								"Unknown improve-questions error",
						);
					}
				}
			}
			idx = buffer.indexOf("\n\n");
		}
	}

	if (!doneRef.current) {
		throw new Error("Improve question stream finished without a done event");
	}
	return doneRef.current;
}
