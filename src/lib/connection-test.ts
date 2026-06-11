import { chat, type StreamChunk } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";

export type ConnectionProgressEvent = {
	progress: number;
	step: string;
};

export type ConnectionResultEvent = {
	response: string;
};

function isTextChunk(
	chunk: StreamChunk,
): chunk is StreamChunk & { delta: string } {
	return (
		chunk.type === "TEXT_MESSAGE_CONTENT" && typeof chunk.delta === "string"
	);
}

export async function runConnectionTestWithProgress(
	config: ProviderConfig,
	onProgress: (event: ConnectionProgressEvent) => void,
	onPrompt: (prompt: string) => void,
	onChunk: (chunk: string) => void,
	abortSignal: AbortSignal,
): Promise<ConnectionResultEvent> {
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Connection test canceled");
		}
	};

	onProgress({ progress: 10, step: "Validating configuration..." });
	assertNotAborted();

	onProgress({ progress: 25, step: "Preparing AI adapter..." });
	const adapter = getAiAdapter(config);
	assertNotAborted();

	const system = "You are a connection test assistant. Respond concisely.";
	const userMsg =
		'Say: "Connection successful using model: <model-name>" and include only one short line.';
	onPrompt(`[System]\n${system}\n\n[User]\n${userMsg}`);

	onProgress({ progress: 40, step: "Connecting to provider..." });

	const stream = chat({
		adapter,
		messages: [{ role: "user", content: userMsg }],
		systemPrompts: [system],
		stream: true,
	});

	let response = "";
	onProgress({ progress: 55, step: "Streaming model response..." });

	for await (const chunk of stream) {
		assertNotAborted();
		if (isTextChunk(chunk) && chunk.delta) {
			response += chunk.delta;
			onChunk(chunk.delta);
		}
	}

	onProgress({ progress: 100, step: "Completed" });
	return { response: response.trim() };
}
