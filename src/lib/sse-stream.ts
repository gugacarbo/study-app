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

export type IngestResultEvent = {
	questions: number;
	topics: string[];
	examId: number;
	fileId: number;
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
		onChunk: (text: string) => void;
		onToken: (prompt: number, completion: number, total: number) => void;
		onWarning?: (message: string) => void;
		onStage?: (stage: {
			stageId: string;
			label: string;
			status: string;
			timestamp: number;
			meta?: Record<string, unknown>;
		}) => void;
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
						const text = (data as { text?: string }).text ?? "";
						if (text) callbacks.onChunk(text);
					}

					if (parsed.event === "token" && data && typeof data === "object") {
						const tokenData = data as {
							prompt?: number;
							completion?: number;
							total?: number;
						};
						callbacks.onToken(
							tokenData.prompt ?? 0,
							tokenData.completion ?? 0,
							tokenData.total ?? 0,
						);
					}

					if (parsed.event === "warning" && data && typeof data === "object") {
						const message = (data as { message?: string }).message ?? "";
						if (message) {
							callbacks.onWarning?.(message);
							callbacks.onStep(`Warning: ${message}`);
						}
					}

					if (parsed.event === "stage" && data && typeof data === "object") {
						const stage = data as {
							stageId?: string;
							label?: string;
							status?: string;
							timestamp?: number;
							meta?: Record<string, unknown>;
						};
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
