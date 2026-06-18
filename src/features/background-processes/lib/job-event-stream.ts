export type JobStreamEvent =
	| {
			type: "event";
			seq: number;
			payload: unknown;
			createdAt: string | null;
	  }
	| {
			type: "job-done";
			status: string;
			error: string | null;
	  };

export type JobEventStreamOptions = {
	jobId: string;
	afterSeq?: number;
	signal?: AbortSignal;
	onEvent: (event: JobStreamEvent) => void;
	onError?: (error: Error) => void;
};

function parseSseChunk(chunk: string): JobStreamEvent | null {
	const line = chunk
		.split("\n")
		.map((part) => part.trim())
		.find((part) => part.startsWith("data:"));

	if (!line) return null;

	const jsonText = line.slice("data:".length).trim();
	if (!jsonText) return null;

	const parsed = JSON.parse(jsonText) as Record<string, unknown>;
	if (parsed.type === "job-done") {
		return {
			type: "job-done",
			status: String(parsed.status ?? ""),
			error: parsed.error != null ? String(parsed.error) : null,
		};
	}

	if (typeof parsed.seq === "number") {
		return {
			type: "event",
			seq: parsed.seq,
			payload: parsed.payload,
			createdAt:
				typeof parsed.createdAt === "string" ? parsed.createdAt : null,
		};
	}

	return null;
}

export async function consumeJobEventStream(
	options: JobEventStreamOptions,
): Promise<void> {
	const after = options.afterSeq ?? 0;
	const url =
		after > 0
			? `/api/jobs/${options.jobId}/stream?after=${after}`
			: `/api/jobs/${options.jobId}/stream`;

	const response = await fetch(url, {
		signal: options.signal,
		credentials: "same-origin",
		headers: { Accept: "text/event-stream" },
	});

	if (!response.ok) {
		throw new Error(`SSE failed: HTTP ${response.status}`);
	}

	if (!response.body) {
		throw new Error("SSE response has no body");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split("\n\n");
			buffer = parts.pop() ?? "";

			for (const part of parts) {
				const event = parseSseChunk(part);
				if (event) options.onEvent(event);
			}
		}

		if (buffer.trim()) {
			const event = parseSseChunk(buffer);
			if (event) options.onEvent(event);
		}
	} catch (error) {
		if (options.signal?.aborted) return;
		options.onError?.(
			error instanceof Error ? error : new Error("SSE stream error"),
		);
		throw error;
	}
}
