import type { ProviderConfig } from "./validation";

export type ConnectionProgressEvent = {
	progress: number;
	step: string;
};

export type ConnectionResultEvent = {
	response: string;
};

function parseEventBlock(
	block: string,
): { event: string; data: string } | null {
	const lines = block.split(/\r?\n/);
	let event = "message";
	const dataLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("event:")) {
			event = line.slice("event:".length).trim();
			continue;
		}
		if (line.startsWith("data:")) {
			dataLines.push(line.slice("data:".length).trim());
		}
	}

	if (dataLines.length === 0) return null;
	return { event, data: dataLines.join("\n") };
}

function toNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function readTokenValue(value: unknown, keys: string[]): number | undefined {
	if (typeof value !== "object" || value === null) return undefined;

	for (const key of keys) {
		if (key in value) {
			const candidate = toNumber((value as Record<string, unknown>)[key]);
			if (candidate != null) {
				return candidate;
			}
		}
	}

	return undefined;
}

export type IngestResultEvent = {
	questions: number;
	topics: string[];
	examId: number;
	fileId: number;
};

export type IngestChunkEvent = {
	stageId?: string;
	agentRunId?: string;
	text: string;
	timestamp?: number;
};

export type IngestTokenEvent = {
	prompt: number;
	completion: number;
	total: number;
	stageId?: string;
	agentRunId?: string;
	timestamp?: number;
};

export type IngestWarningEvent = {
	message: string;
	stageId?: string;
	agentRunId?: string;
	timestamp?: number;
};

export type IngestStageEvent = {
	stageId: string;
	label: string;
	status: string;
	timestamp: number;
	meta?: Record<string, unknown>;
};

export type IngestAgentEvent = {
	eventType?: "lifecycle" | "result" | "warning" | "token";
	agentRunId: string;
	stageId: string;
	label: string;
	status?: string;
	timestamp?: number;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?:
		| {
				prompt?: number;
				completion?: number;
				total?: number;
		  }
		| unknown;
	meta?: Record<string, unknown>;
};

export async function ingestStream(
	payload: {
		buffer: number[];
		fileName: string;
		config: ProviderConfig;
		enableReview?: boolean;
		signal?: AbortSignal;
	},
	callbacks: {
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
	},
): Promise<IngestResultEvent> {
	const response = await fetch("/api/ingest", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			buffer: payload.buffer,
			fileName: payload.fileName,
			config: payload.config,
			enableReview: payload.enableReview ?? true,
		}),
		signal: payload.signal,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Ingest failed (${response.status})`);
	}

	if (!response.body) {
		throw new Error("Ingest stream is not available");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let result: IngestResultEvent | null = null;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let separatorIndex = buffer.indexOf("\n\n");

		while (separatorIndex >= 0) {
			const block = buffer.slice(0, separatorIndex).trim();
			buffer = buffer.slice(separatorIndex + 2);

			if (block) {
				const parsed = parseEventBlock(block);
				if (parsed) {
					let data: unknown;
					try {
						data = JSON.parse(parsed.data);
					} catch {
						data = null;
					}

					if (parsed.event === "progress" && data && typeof data === "object") {
						const step = (data as { step?: string }).step ?? "";
						callbacks.onStep(step);
					}

					if (parsed.event === "chunk" && data && typeof data === "object") {
						const chunkData = data as {
							text?: string;
							stageId?: string;
							agentRunId?: string;
							timestamp?: number;
						};
						const text = chunkData.text ?? "";
						if (text) {
							callbacks.onChunk?.(text, {
								text,
								stageId: chunkData.stageId,
								agentRunId: chunkData.agentRunId,
								timestamp: chunkData.timestamp,
							});
						}
					}

					if (parsed.event === "token" && data && typeof data === "object") {
						const tokenData = data as {
							prompt?: number;
							completion?: number;
							total?: number;
							stageId?: string;
							agentRunId?: string;
							timestamp?: number;
							usage?: unknown;
						};
						const usage = tokenData.usage;
						const prompt =
							tokenData.prompt ??
							readTokenValue(usage, [
								"prompt",
								"promptTokens",
								"inputTokens",
							]) ??
							0;
						const completion =
							tokenData.completion ??
							readTokenValue(usage, [
								"completion",
								"completionTokens",
								"outputTokens",
							]) ??
							0;
						const total =
							tokenData.total ??
							readTokenValue(usage, ["total", "totalTokens"]) ??
							prompt + completion;
						callbacks.onToken(prompt, completion, total, {
							prompt,
							completion,
							total,
							stageId: tokenData.stageId,
							agentRunId: tokenData.agentRunId,
							timestamp: tokenData.timestamp,
						});
					}

					if (parsed.event === "warning" && data && typeof data === "object") {
						const warningData = data as {
							message?: string;
							stageId?: string;
							agentRunId?: string;
							timestamp?: number;
						};
						const message = warningData.message ?? "";
						if (message) {
							callbacks.onWarning?.(message, {
								message,
								stageId: warningData.stageId,
								agentRunId: warningData.agentRunId,
								timestamp: warningData.timestamp,
							});
							callbacks.onStep(`Warning: ${message}`);
						}
					}

					if (parsed.event === "stage" && data && typeof data === "object") {
						const stage = data as Partial<IngestStageEvent>;
						if (stage.stageId && stage.label && stage.status) {
							callbacks.onStage?.({
								stageId: stage.stageId,
								label: stage.label,
								status: stage.status,
								timestamp: stage.timestamp ?? Date.now(),
								meta: stage.meta,
							});
						}
					}

					if (parsed.event === "agent" && data && typeof data === "object") {
						const agent = data as Partial<IngestAgentEvent>;
						if (agent.agentRunId && agent.stageId && agent.label) {
							callbacks.onAgent?.({
								eventType: agent.eventType,
								agentRunId: agent.agentRunId,
								stageId: agent.stageId,
								label: agent.label,
								status: agent.status,
								timestamp: agent.timestamp,
								systemPrompt: agent.systemPrompt,
								userPrompt: agent.userPrompt,
								rawText: agent.rawText,
								finalObject: agent.finalObject,
								error: agent.error,
								warning: agent.warning,
								tokens: agent.tokens,
								meta: agent.meta,
							});
						}
					}

					if (parsed.event === "result" && data && typeof data === "object") {
						result = data as IngestResultEvent;
					}

					if (parsed.event === "error" && data && typeof data === "object") {
						const message =
							(data as { message?: string }).message ?? "Unknown ingest error";
						throw new Error(message);
					}
				}
			}

			separatorIndex = buffer.indexOf("\n\n");
		}
	}

	if (!result) {
		throw new Error("Ingest stream finished without a result");
	}

	return result;
}

export async function testConnectionWithStream(
	payload: ProviderConfig,
	callbacks: {
		onProgress: (event: ConnectionProgressEvent) => void;
		onPrompt: (prompt: string) => void;
		onChunk: (chunk: string) => void;
	},
): Promise<ConnectionResultEvent> {
	const response = await fetch("/api/test-connection", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Connection test failed (${response.status})`);
	}

	if (!response.body) {
		throw new Error("Connection test stream is not available");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let result: ConnectionResultEvent | null = null;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let separatorIndex = buffer.indexOf("\n\n");

		while (separatorIndex >= 0) {
			const block = buffer.slice(0, separatorIndex).trim();
			buffer = buffer.slice(separatorIndex + 2);

			if (block) {
				const parsed = parseEventBlock(block);
				if (parsed) {
					let data: unknown;
					try {
						data = JSON.parse(parsed.data);
					} catch {
						data = null;
					}

					if (parsed.event === "progress" && data && typeof data === "object") {
						callbacks.onProgress(data as ConnectionProgressEvent);
					}

					if (parsed.event === "prompt" && data && typeof data === "object") {
						const prompt = (data as { prompt?: string }).prompt ?? "";
						callbacks.onPrompt(prompt);
					}

					if (parsed.event === "chunk" && data && typeof data === "object") {
						const chunk = (data as { chunk?: string }).chunk ?? "";
						if (chunk) callbacks.onChunk(chunk);
					}

					if (parsed.event === "result" && data && typeof data === "object") {
						result = data as ConnectionResultEvent;
					}

					if (parsed.event === "error" && data && typeof data === "object") {
						const message =
							(data as { message?: string }).message ??
							"Unknown connection test error";
						throw new Error(message);
					}
				}
			}

			separatorIndex = buffer.indexOf("\n\n");
		}
	}

	if (!result) {
		throw new Error("Connection test stream finished without a result");
	}

	return result;
}
