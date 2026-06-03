import type { ProviderConfig } from "../validation";
import type { ConnectionProgressEvent, ConnectionResultEvent } from "./types";

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
	let result: ConnectionResultEvent | null = null;
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = decoder.decode(value, { stream: true });
		buffer += chunk;

		let separatorIndex = buffer.indexOf("\n\n");
		while (separatorIndex >= 0) {
			const block = buffer.slice(0, separatorIndex).trim();
			buffer = buffer.slice(separatorIndex + 2);

			if (block) {
				const events = block.split(/\r?\n/);
				let event = "message";
				const dataLines: string[] = [];

				for (const line of events) {
					if (line.startsWith("event:")) {
						event = line.slice("event:".length).trim();
					} else if (line.startsWith("data:")) {
						dataLines.push(line.slice("data:".length).trim());
					}
				}

				const dataStr = dataLines.join("\n");
				if (dataStr) {
					try {
						const data = JSON.parse(dataStr);
						if (event === "progress" && typeof data === "object") {
							callbacks.onProgress(data as ConnectionProgressEvent);
						}
						if (event === "prompt" && typeof data === "object") {
							const p = (data as { prompt?: string }).prompt ?? "";
							callbacks.onPrompt(p);
						}
						if (event === "chunk" && typeof data === "object") {
							const c = (data as { chunk?: string }).chunk ?? "";
							if (c) callbacks.onChunk(c);
						}
						if (event === "result" && typeof data === "object") {
							result = data as ConnectionResultEvent;
						}
						if (event === "error" && typeof data === "object") {
							const m =
								(data as { message?: string }).message ??
								"Unknown connection test error";
							throw new Error(m);
						}
					} catch (parseError) {
						console.warn("SSE stream JSON parse failed:", dataStr, parseError);
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
