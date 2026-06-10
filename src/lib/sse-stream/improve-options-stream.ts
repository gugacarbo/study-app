import type {
	DraftQuestion,
	ImproveOptionsAgentEvent,
	ImproveOptionsAgentRunSummary,
	ImproveOptionsDoneEvent,
	WorkspaceUpdateEvent,
} from "@/features/ai/agents/improve-options/contracts";
import { parseEventBlock } from "./parser";

function normalizeDoneEvent(raw: unknown): ImproveOptionsDoneEvent | null {
	if (typeof raw !== "object" || raw == null) return null;
	const data = raw as Record<string, unknown>;

	if (data.finalQuestion && data.agentRun) {
		return {
			finalQuestion: data.finalQuestion as DraftQuestion,
			agentRun: data.agentRun as ImproveOptionsAgentRunSummary,
		};
	}

	if (data.question && data.agentRun) {
		return {
			finalQuestion: data.question as DraftQuestion,
			agentRun: data.agentRun as ImproveOptionsAgentRunSummary,
		};
	}

	return null;
}

export type ImproveOptionsTextChunk = {
	text: string;
	kind?: "text" | "reasoning";
	agentRunId?: string;
};

type ImproveOptionsCallbacks = {
	onAgent?: (event: ImproveOptionsAgentEvent) => void;
	onChunk?: (chunk: ImproveOptionsTextChunk) => void;
	onWorkspaceUpdate?: (event: WorkspaceUpdateEvent) => void;
	onDone?: (event: ImproveOptionsDoneEvent) => void;
};

function shouldYieldAfterAgentToolEvent(event: string, raw: unknown): boolean {
	if (event !== "agent" || typeof raw !== "object" || raw == null) {
		return false;
	}
	const eventType = (raw as { eventType?: unknown }).eventType;
	return eventType === "tool-call" || eventType === "tool-result";
}

function yieldToRenderer(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}

function dispatchChunk(
	raw: unknown,
	callbacks: ImproveOptionsCallbacks,
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
	callbacks: ImproveOptionsCallbacks,
): void {
	if (typeof raw !== "object" || raw == null) return;
	const event = raw as Partial<ImproveOptionsAgentEvent>;
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

export async function improveOptionsStream(
	payload: { questionId: number; signal?: AbortSignal },
	callbacks: ImproveOptionsCallbacks,
): Promise<ImproveOptionsDoneEvent> {
	const res = await fetch("/api/improve-options", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ questionId: payload.questionId }),
		signal: payload.signal,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `Improve options failed (${res.status})`);
	}
	if (!res.body) {
		throw new Error("Improve options stream is not available");
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	const doneRef = { current: null as ImproveOptionsDoneEvent | null };
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
								"Unknown improve options error",
						);
					}

					if (shouldYieldAfterAgentToolEvent(parsed.event, data)) {
						await yieldToRenderer();
					}
				}
			}
			idx = buffer.indexOf("\n\n");
		}
	}

	if (!doneRef.current) {
		throw new Error("Improve options stream finished without a done event");
	}
	return doneRef.current;
}
