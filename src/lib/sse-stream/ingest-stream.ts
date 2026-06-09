import type { ProviderConfig } from "../validation";
import { parseEventBlock, readTokenValue } from "./parser";
import type {
	IngestAgentEvent,
	IngestChunkEvent,
	IngestResultEvent,
	IngestStageEvent,
	IngestTokenEvent,
	IngestWarningEvent,
} from "./types";

type IngestCallbacks = {
	onStep: (step: string) => void;
	onChunk?: (text: string, event?: IngestChunkEvent) => void;
	onToken: (
		prompt: number,
		completion: number,
		total: number,
		event?: IngestTokenEvent,
	) => void;
	onWarning?: (message: string, event?: IngestWarningEvent) => void;
	onStage?: (stage: IngestStageEvent) => void;
	onAgent?: (event: IngestAgentEvent) => void;
};

function dispatch(
	event: string,
	raw: unknown,
	c: IngestCallbacks,
	ref: { current: IngestResultEvent | null },
): void {
	if (event === "progress" && typeof raw === "object" && raw) {
		c.onStep((raw as { step?: string }).step ?? "");
		return;
	}
	if (event === "chunk" && typeof raw === "object" && raw) {
		const d = raw as {
			text?: string;
			kind?: "text" | "reasoning";
			stageId?: string;
			agentRunId?: string;
			timestamp?: number;
		};
		if (d.text)
			c.onChunk?.(d.text, {
				text: d.text,
				kind: d.kind === "reasoning" ? "reasoning" : "text",
				stageId: d.stageId,
				agentRunId: d.agentRunId,
				timestamp: d.timestamp,
			});
		return;
	}
	if (event === "token" && typeof raw === "object" && raw) {
		const d = raw as {
			prompt?: number;
			completion?: number;
			total?: number;
			stageId?: string;
			agentRunId?: string;
			timestamp?: number;
			usage?: unknown;
		};
		const u = d.usage;
		const p =
			d.prompt ??
			readTokenValue(u, ["prompt", "promptTokens", "inputTokens"]) ??
			0;
		const co =
			d.completion ??
			readTokenValue(u, ["completion", "completionTokens", "outputTokens"]) ??
			0;
		const t = d.total ?? readTokenValue(u, ["total", "totalTokens"]) ?? p + co;
		c.onToken(p, co, t, {
			prompt: p,
			completion: co,
			total: t,
			stageId: d.stageId,
			agentRunId: d.agentRunId,
			timestamp: d.timestamp,
		});
		return;
	}
	if (event === "warning" && typeof raw === "object" && raw) {
		const d = raw as {
			message?: string;
			stageId?: string;
			agentRunId?: string;
			timestamp?: number;
		};
		if (d.message) {
			c.onWarning?.(d.message, {
				message: d.message,
				stageId: d.stageId,
				agentRunId: d.agentRunId,
				timestamp: d.timestamp,
			});
			c.onStep(`Warning: ${d.message}`);
		}
		return;
	}
	if (event === "stage" && typeof raw === "object" && raw) {
		const d = raw as Partial<IngestStageEvent>;
		if (d.stageId && d.label && d.status) {
			c.onStage?.({
				stageId: d.stageId,
				label: d.label,
				status: d.status,
				timestamp: d.timestamp ?? Date.now(),
				meta: d.meta,
			});
		}
		return;
	}
	if (event === "agent" && typeof raw === "object" && raw) {
		const d = raw as Partial<IngestAgentEvent>;
		if (d.agentRunId && d.stageId && d.label) {
			c.onAgent?.({
				eventType: d.eventType,
				agentRunId: d.agentRunId,
				stageId: d.stageId,
				label: d.label,
				status: d.status,
				state: d.state,
				timestamp: d.timestamp,
				systemPrompt: d.systemPrompt,
				userPrompt: d.userPrompt,
				rawText: d.rawText,
				finalObject: d.finalObject,
				error: d.error,
				warning: d.warning,
				tokens: d.tokens,
				meta: d.meta,
				name: d.name,
				arguments: d.arguments,
				input: d.input,
				output: d.output,
				content: d.content,
			});
		}
		return;
	}
	if (event === "result" && typeof raw === "object" && raw) {
		ref.current = raw as IngestResultEvent;
		return;
	}
	if (event === "error" && typeof raw === "object" && raw) {
		throw new Error(
			(raw as { message?: string }).message ?? "Unknown ingest error",
		);
	}
}

export async function ingestStream(
	payload: {
		buffer: number[];
		fileName: string;
		config: ProviderConfig;
		enableReview?: boolean;
		enableExplanations?: boolean;
		signal?: AbortSignal;
	},
	callbacks: IngestCallbacks,
): Promise<IngestResultEvent> {
	const res = await fetch("/api/ingest", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			buffer: payload.buffer,
			fileName: payload.fileName,
			config: payload.config,
			enableReview: payload.enableReview ?? true,
			enableExplanations: payload.enableExplanations ?? true,
		}),
		signal: payload.signal,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(text || `Ingest failed (${res.status})`);
	}
	if (!res.body) throw new Error("Ingest stream is not available");

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	const resultRef = { current: null as IngestResultEvent | null };
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
					dispatch(parsed.event, data, callbacks, resultRef);
				}
			}
			idx = buffer.indexOf("\n\n");
		}
	}

	if (!resultRef.current)
		throw new Error("Ingest stream finished without a result");
	return resultRef.current;
}
